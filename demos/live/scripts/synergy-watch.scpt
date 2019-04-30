tell application "iTerm2"
  tell current session of current tab of current window
    split vertically with default profile
  end tell
  tell second session of current tab of current window
    write text "cd src/antares/demos/live; watch -n 0.2 'cat synergy.stderr'"
  end tell
end tell
