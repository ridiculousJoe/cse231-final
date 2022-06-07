import { assertPrint, assertFail, assertTCFail, assertTC } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"

describe("tolist-str test", () => {
  // 1
  assertPrint("input-string-literal",
    `
a:[str] = None
a = list("012")
print(a[0])
print(a[1])
print(a[2])
`, ["0", "1", "2"]);
  // 2
  assertPrint("input-id-empty-string",
    `
a:[str] = None
b:str = ""
a = list(b)
print(a[0])
`, [""]);
  // 3
  assertPrint("input-method-return-string",
    `
class B(object):
	b:str = "012"
	def __init__(self: B):
	  self.b = "345"
	def f(self: B) -> str:
		return self.b
a:[str] = None
b:B = None
b = B()
a = list(b.f())
print(a[0])
print(a[1])
print(a[2])`, ["3", "4", "5"]);
  // 4
  assertPrint("output-len",
    `
a:[str] = None
a = list("012")
print(len(a))
`, ["3"]);
  // 5
  assertPrint("output-concat-for",
    `
a:[str] = None
b:[str] = None
c:[str] = None
s:str = ""
a = list("012")
b = list("345")
c = a + b
for s in c:
    print(s)
`, ["0", "1", "2", "3", "4", "5"]);
});
