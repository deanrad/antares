tell application "iTerm2"
  tell current session of current tab of current window
    split horizontally with default profile
  end tell
  tell second session of current tab of current window
    write text "watch -t -n 1 'echo \"Processes matching *biz-consultant*\n\"; pgrep -lf biz-consultant'"
  end tell
end tell
