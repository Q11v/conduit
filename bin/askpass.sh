#!/bin/sh
# ssh 需要输入时调用本脚本，提示词是 $1。
# 只回答密码/口令类提示。主机密钥确认（"Are you sure you want to continue…"）
# 一律拒答 —— 否则会把密码当成 yes/no 送出去，等于盲目接受未知主机密钥。
case "$1" in
  *[Pp]assword*|*[Pp]assphrase*) printf '%s\n' "$CONDUIT_PASSWORD" ;;
  *) exit 1 ;;
esac
