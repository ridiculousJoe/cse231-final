import { readFileSync } from "fs";

enum Type { Num, Bool, Str, None }

function stringify(typ: Type, arg: any): string {
  switch (typ) {
    case Type.Num:
      return (arg as number).toString();
    case Type.Bool:
      return (arg as boolean) ? "True" : "False";
    case Type.Str:
      const len = new Uint32Array(importObject.memory_values.buffer, arg, 1)[0];
      return String.fromCharCode.apply(null, new Uint32Array(importObject.memory_values.buffer, arg + 4, len));
    case Type.None:
      return "None";
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  return arg;
}

function eq_str(left: number, right: number): number {
  const leftLen = new Uint32Array(importObject.memory_values.buffer, left, 1)[0];
  const leftStr = String.fromCharCode.apply(null, new Uint32Array(importObject.memory_values.buffer, left + 4, leftLen));
  const rightLen = new Uint32Array(importObject.memory_values.buffer, right, 1)[0];
  const rightStr = String.fromCharCode.apply(null, new Uint32Array(importObject.memory_values.buffer, right + 4, rightLen));
  return (leftStr === rightStr) ? 1 : 0;
}

function len_list(arg:any):any{
  return new Uint32Array(importObject.memory_values.buffer, arg, 1)[0];
}

function len(typ: Type, arg: any): Number {
  switch (typ) {
    case Type.Str:
      return new Uint32Array(importObject.memory_values.buffer, arg, 1)[0];
    default:
      throw new Error(`Undefined function len for type ${typ}`);
  }
}

function assert_not_none(arg: any) : any {
  if (arg === 0)
    throw new Error("RUNTIME ERROR: cannot perform operation on none");
  return arg;
}


function assert_out_of_bound(length: any, index: any): any{
  if(index > length){
    throw new Error("RUNTIME ERROR: index out of bound");
  }
  return index;
}

export async function addLibs() {
  const bytes = readFileSync("build/memory.wasm");
  const memory = new WebAssembly.Memory({initial:10, maximum:100});
  const memoryModule = await WebAssembly.instantiate(bytes, { js: { mem: memory } })
  importObject.libmemory = memoryModule.instance.exports,
  importObject.memory_values = memory;
  importObject.js = {memory};
  return importObject;
}

export const importObject : any = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    assert_out_of_bound: (length:any, index: any)=> assert_out_of_bound(length, index),
    assert_not_none: (arg: any) => assert_not_none(arg),
    print: (arg: any) => print(Type.Num, arg),
    print_num: (arg: number) => print(Type.Num, arg),
    print_bool: (arg: number) => print(Type.Bool, arg),
    print_str: (arg: number) => print(Type.Str, arg),
    print_none: (arg: number) => print(Type.None, arg),
    len_list: (arg: number) => len_list(arg),
    len_str: (arg: number) => len(Type.Str, arg),
    eq_str: (left: number, right: number) => eq_str(left, right),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  output: "",
};
