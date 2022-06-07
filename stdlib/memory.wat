(module
  (memory (import "js" "mem") 1)
  (global $heap (mut i32) (i32.const 4))

  ;; Take an amount of blocks (4-byte words) to allocate, return an address
  ;; handle suitable for giving to other access methods
  (func $alloc (export "alloc") (param $amount i32) (result i32)
    (local $addr i32)
    (local.set $addr (global.get $heap))
    (global.set $heap (i32.add (global.get $heap) (i32.mul (local.get $amount) (i32.const 4))))
    (local.get $addr))

  ;; Given an address handle, return the value at that address
  (func $load (export "load") (param $addr i32) (param $offset i32) (result i32)
    (i32.load (i32.add (local.get $addr) (i32.mul (local.get $offset) (i32.const 4)))))

  ;; Given an address handle and a new value, update the value at that adress to
  ;; that value
  (func $store (export "store") (param $addr i32) (param $offset i32) (param $val i32)
    (i32.store (i32.add (local.get $addr) (i32.mul (local.get $offset) (i32.const 4))) (local.get $val)))

  ;; Given a target address and an array (expressed as a start address and a length), copy the values of the array to
  ;; the target address. Return the following target address.
  ;; pseudo code:
  ;; int i = 0
  ;; for (; i < length; ++i) {
  ;;    target[i] = source[1 + i]
  ;; }
  ;; return target + length * 4
  (func $copy (export "copy") (param $target i32) (param $source i32) (param $length i32) (result i32)
    ;; int i = 0
    (local $i i32)
    (local.set $i (i32.const 0))

    (loop $my_loop
      ;; i < length
      (i32.lt_s (local.get $i) (local.get $length))
      (if
        (then
          ;; target[i] = source[1 + i]
          (call $store (local.get $target) (local.get $i) (call $load (local.get $source) (i32.add (i32.const 1) (local.get $i))))

          ;; ++i
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $my_loop)
        )
        (else
          ;; end loop
        )
      )
    )

    ;; return target + length * 4
    (i32.add (local.get $target) (i32.mul (local.get $length) (i32.const 4)))
  )

  ;; Given the address of a string str, return the address of list(str)
  ;; e.g.,
  ;; vowel_string = "aeiou"
  ;; list(vowel_string)
  ;; ["a", "e", "i", "o", "u"]
  ;; pseudo code:
  ;; int n = source[0]
  ;; int i = 0
  ;; int j = 1
  ;; if (n == 0) {
  ;;  target = alloc(2)
  ;;  target[0] = 1
  ;;  target[1] = source
  ;; } else {
  ;;  tmp = alloc(2 * n)
  ;;  target = alloc(n + 1)
  ;;  target[0] = n
  ;;  for (; j <= n; ) {
  ;;    tmp[i] = 1
  ;;    tmp[i + 1] = source[j]
  ;;    target[j] = tmp + i * 4
  ;;    i += 2
  ;;    j += 1
  ;;  }
  ;;  return target
  ;; }
    (func $tolist_str (export "tolist_str") (param $source i32) (result i32)
      ;; int n = source[0], i = 0, j = 1
      (local $n i32)
      (local $i i32)
      (local $j i32)
      (local $target i32)
      (local $tmp i32)
      (local.set $n (call $load (local.get $source) (i32.const 0)))
      (local.set $i (i32.const 0))
      (local.set $j (i32.const 1))
      ;; if (n == 0)
      (i32.eq (local.get $n) (i32.const 0))
      (if
        (then
          ;; target = alloc(2)
          (local.set $target (call $alloc (i32.const 2)))
          ;; target[0] = 1
          (call $store (local.get $target) (i32.const 0) (i32.const 1))
          ;; target[1] = source
          (call $store (local.get $target) (i32.const 1) (local.get $source))
        )
        (else
          ;; tmp = alloc(2 * n)
          (local.set $tmp (call $alloc (i32.mul (i32.const 2) (local.get $n))))
          ;; target = alloc(n + 1)
          (local.set $target (call $alloc (i32.add (local.get $n) (i32.const 1))))
          ;; target[0] = n
          (call $store (local.get $target) (i32.const 0) (local.get $n))
          (loop $my_loop
            ;; j <= n
            (i32.le_s (local.get $j) (local.get $n))
            (if
              (then
                ;; tmp[i] = 1
                (call $store (local.get $tmp) (local.get $i) (i32.const 1))
                ;; tmp[i + 1] = source[j]
                (call $store (local.get $tmp) (i32.add (local.get $i) (i32.const 1)) (call $load (local.get $source) (local.get $j)))
                ;; target[j] = tmp + i * 4
                (call $store (local.get $target) (local.get $j) (i32.add (local.get $tmp) (i32.mul (local.get $i) (i32.const 4))))
                ;; i += 2
                (local.set $i (i32.add (local.get $i) (i32.const 2)))
                ;; j += 1
                (local.set $j (i32.add (local.get $j) (i32.const 1)))
                ;; do loop
                (br $my_loop)
              )
              (else
                ;; end loop
              )
            )
          )
        )
      )
      ;; return target
      (local.get $target)
    )
)