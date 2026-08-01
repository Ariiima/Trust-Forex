set -e
run() { # name ref route width height
  node design/review/shoot.mjs "$3" /tmp/fig/sw-$1.png 360 "$4" 1400 >/dev/null 2>&1
  printf "%-16s " "$1"
  python3 design/review/compare.py design/review/ref/$2.png /tmp/fig/sw-$1.png /tmp/fig/swd-$1.png 2>/dev/null | head -1
}
B=http://localhost:5199
run splash        splash        "$B/splash" 776
run skeleton      skeleton      "$B/loading" 1730
run ref-preview   ref-preview   "$B/referral?state=preview" 776
run ref-main      ref-main      "$B/referral?state=main" 1190
run ref-empty     ref-empty     "$B/referral?state=empty" 902
run ref-about     ref-about     "$B/referral?state=main&sheet=about" 776
run earn-main     earn-main     "$B/earning" 968
run earn-history  earn-history  "$B/earning?sheet=history" 776
run wd-cur        wd-cur        "$B/earning/withdraw" 924
run wd-cur-sel    wd-cur-sel    "$B/earning/withdraw?selected=usdt-bep20" 924
run wd-amt        wd-amt        "$B/earning/withdraw/amount" 776
run wd-amt-filled wd-amt-filled "$B/earning/withdraw/amount?amount=245&wallet=0X1C4212345678948Hf7f8" 776
run wd-change     wd-change     "$B/earning/withdraw/amount?sheet=change" 776
run wd-summary    wd-summary    "$B/earning/withdraw/amount?sheet=summary&amount=245&wallet=0X1C4212345678948Hf7f8" 776
run wd-submitted  wd-submitted  "$B/earning/withdraw/amount?sheet=submitted&amount=245&wallet=0X1C4212345678948Hf7f8" 776
