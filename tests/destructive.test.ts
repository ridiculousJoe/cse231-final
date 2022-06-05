import { assertPrint, assertFail, assertTCFail, assertTC } from "./asserts.test";
import { NUM, BOOL, NONE, CLASS } from "./helpers.test"

describe("destructive test", () => {
    // 1
    assertPrint("destructive-assign-basic",
        `
a : [int] = None
x : int = 0
y : int = 0
z : int = 0
a = [1,2,3]
x, y, z = a
print(x)
print(y)
print(z)`, ["1", "2", "3"]
    );
    assertPrint("destructive-raw-list",
        `
x : int = 0
y : int = 0
z : int = 0

x, y, z = [1,2,3]
print(x)
print(y)
print(z)`, ["1", "2", "3"]
    );
    assertPrint("destructive-in-function",
        `
x : int = 0
y : int = 0
z : int = 0

def f(x: int, y: int, z: int) -> int:
 x, y, z = [3, 4, 5]
 return x+y+z

print(f(x,y,z))`, ["12"]
    );
    assertTCFail("mismatch-id-list-type", `
a : [int] = None
x : int = 0
y : str = "0"
z : int = 0

a = [1, 2, 3]
x, y, z = a
print(x)
print(y)
print(z) 
`);
    assertTCFail("left-shorter-than-right", `
a : [int] = None
x : int = 0
y : int = 0

a = [1,2,3]
x, y = a

print(x)
print(y)
`);
    assertTCFail("left-longer-than-right", `
a : [int] = None
x : int = 0
y : int = 0
z : int = 0
u : int = 0

a = [1,2,3]
x, y, z, u = a

print(x)
print(y)
print(z)
print(u)
`);
});
