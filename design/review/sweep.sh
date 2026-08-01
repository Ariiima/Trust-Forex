# Diffs every designed screen against its 1:1 Figma frame. Needs the dev
# server on 5199 (npm run dev). Reference PNGs are the full frame; compare.py
# crops their top 76px of Telegram/iOS chrome, so the capture height passed
# here is always (frame height - 76).
#
#   sh design/review/sweep.sh            # all screens
#   sh design/review/sweep.sh pay        # only names containing "pay"
set -e
ONLY="$1"
run() { # name ref route height
  case "$1" in *"$ONLY"*) ;; *) return 0 ;; esac
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

# Screens that predate the Figma resync. ?tip and ?account are review states
# the frames capture; they are query params so the live defaults stay honest.
run home          home-active   "$B/?tip" 1538
run plans         plans         "$B/plans" 984
run checkout      checkout      "$B/checkout" 776
run pay-currency  pay-currency  "$B/payment/currency" 776
run pay-network   pay-network   "$B/payment/network" 776
run pay-receive   pay-receive   "$B/payment/receive" 776
run cashback      cashback      "$B/cashback" 1598
run cb-history    cashback-history "$B/cashback/history" 776
run broker        broker        "$B/cashback/broker/xm?account=submitted" 902
