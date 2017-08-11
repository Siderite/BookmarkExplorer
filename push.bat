@echo off
DEL BookmarkExplorer@Siderite.org.xpi
"C:\Program Files\7-Zip\7z.exe" a BookmarkExplorer@Siderite.org.xpi *.* -tzip -mx0
"C:\Program Files (x86)\platform-tools\adb.exe" push BookmarkExplorer@Siderite.org.xpi /mnt/sdcard