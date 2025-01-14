// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import { compile, GlobalEnv } from './compiler';
import {parse} from './parser';
import {emptyLocalTypeEnv, GlobalTypeEnv, tc, tcStmt} from  './type-check';
import { Program, Type, Value } from './ast';
import { PyValue, NONE, BOOL, NUM, CLASS, STR } from "./utils";
import { generateName, lowerProgram } from './lower';
import { liftprogram } from './lambdalift'
import {match} from "assert";
import * as AST from "./ast";

export type Config = {
  importObject: any;
  // env: compiler.GlobalEnv,
  env: GlobalEnv,
  typeEnv: GlobalTypeEnv,
  functions: string        // prelude functions
}

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

export async function runWat(source : string, importObject : any) : Promise<any> {
  const wabtInterface = await wabt();
  const myModule = wabtInterface.parseWat("test.wat", source);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return [result, wasmModule];
}

// function generateDefaultMethods(program: AST.Program<any>) {
//   program.classes.forEach(cls => {
//     if(cls.superclass !== "object") {
//       const methods = cls.methods;
//       const supercls = cls.superclass;
//       const superMethods = program.classes.find(cls => cls.name === supercls).methods;
//       superMethods.forEach((sm, idx) => {
//         if(sm.name !== "__init__") {
//           if(!methods.some(method => method.name === sm.name)) {
//             cls.methods.push(sm);
//           }
//         }
//       })
//     }
//   })
// }


export function augmentEnv(env: GlobalEnv, prog: Program<Type>, strings : Map<string, string>) : GlobalEnv {
  const newGlobals = new Map(env.globals);
  const newClasses = new Map(env.classes);

  var newOffset = env.offset;
  var moffset = 0;
  prog.inits.forEach((v) => {
    newGlobals.set(v.name, true);
  });

  prog.classes.forEach(cls => {
    const classFields = new Map();
    const methods = new Map();
    var offset = 0;
    if(cls.superclass !== "object") {
      const superFields = newClasses.get(cls.superclass)[0];
      superFields.forEach((v, _) => {
        offset = Math.max(offset, v[0]+1);
      })
    }
    cls.methods.filter(m => m.name !== "__init__").forEach((m, index) => {
      var midx = moffset + index;
      var override = false;
      if (cls.superclass !== "object" ){
        newClasses.get(cls.superclass)[1].forEach((v, k) => {
          if (k === m.name) {
            midx = v;
            override = true;
          }
        })
      }
      if (!override) moffset += 1;
      methods.set(m.name, midx)
    })
    cls.fields.forEach((field, i) => classFields.set(field.name, [i+offset, field.value]));
    newClasses.set(cls.name, [classFields, methods, cls.superclass]);
  });
  return {
    strings,
    globals: newGlobals,
    classes: newClasses,
    locals: env.locals,
    labels: env.labels,
    offset: newOffset,
    vtable: env.vtable,
    classRange: env.classRange,
  }
}


function getStrings(source: string) : Map<string, string> {
  // TODO: figure regexp out
  var myRegExp = new RegExp(`(["'])(?:(?!\\1)[^\\\\]|\\\\.)*\\1`, "gm");
  var matches = source.matchAll(myRegExp);
  var res = new Map<string, string>();
  for (const match of matches) {
    res.set(match[0].slice(1, -1), generateName("newStr"));
  }
  return res;
}

// export async function run(source : string, config: Config) : Promise<[Value, compiler.GlobalEnv, GlobalTypeEnv, string]> {
export async function run(source : string, config: Config) : Promise<[Value, GlobalEnv, GlobalTypeEnv, string, WebAssembly.WebAssemblyInstantiatedSource]> {
  const strings = getStrings(source);
  const parsed = parse(source);
  // generateDefaultMethods(parsed);
  const [tprogram, tenv] = tc(config.typeEnv, parsed);
  const lprogram = liftprogram(tprogram);
  const globalEnv = augmentEnv(config.env, lprogram, strings);
  const irprogram = lowerProgram(lprogram, globalEnv);
  const progTyp = lprogram.a;
  var returnType = "";
  var returnExpr = "";
  // const lastExpr = parsed.stmts[parsed.stmts.length - 1]
  // const lastExprTyp = lastExpr.a;
  // console.log("LASTEXPR", lastExpr);
  if(progTyp !== NONE) {
    returnType = "(result i32)";
    returnExpr = "(local.get $$last)"
  } 
  let globalsBefore = config.env.globals;
  // const compiled = compiler.compile(tprogram, config.env);
  const compiled = compile(irprogram, globalEnv);

  const globalImports = [...globalsBefore.keys()].map(name =>
    `(import "env" "${name}" (global $${name} (mut i32)))`
  ).join("\n");
  const globalDecls = compiled.globals.map(name =>
    `(global $${name} (export "${name}") (mut i32) (i32.const 0))`
  ).join("\n");

  const importObject = config.importObject;
  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:2000, maximum:2000});
    importObject.js = { memory: memory };
  }

  const wasmSource = `(module
    (import "js" "memory" (memory 1))
    (func $assert_not_none (import "imports" "assert_not_none") (param i32) (result i32))
    (func $assert_out_of_bound (import "imports" "assert_out_of_bound")(param i32)(param i32)(result i32))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
    (func $print_str (import "imports" "print_str") (param i32) (result i32))
    (func $print_none (import "imports" "print_none") (param i32) (result i32))
    (func $len_str (import "imports" "len_str") (param i32) (result i32))
    (func $len_list (import "imports" "len_list") (param i32) (result i32))
    (func $eq_str (import "imports" "eq_str") (param i32) (param i32) (result i32))
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    (func $alloc (import "libmemory" "alloc") (param i32) (result i32))
    (func $load (import "libmemory" "load") (param i32) (param i32) (result i32))
    (func $store (import "libmemory" "store") (param i32) (param i32) (param i32))
    (func $copy (import "libmemory" "copy") (param i32) (param i32) (param i32) (result i32))
    ${globalImports}
    ${compiled.vtable}
    ${globalDecls}
    ${config.functions}
    ${compiled.functions}
    (func (export "exported_func") ${returnType}
      ${compiled.mainSource}
      ${returnExpr}
    )
  )`;
  console.log(wasmSource);
  const [result, instance] = await runWat(wasmSource, importObject);

  return [PyValue(progTyp, result), compiled.newEnv, tenv, compiled.functions, instance];
}
