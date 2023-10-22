@ECHO OFF
chcp 65001
SET infile=%1
SET outFile=%2
SET split=%3
SET layout=%4
SET size=%5
SET duration=%6
SET coded_height=%7
SET coded_width=%8
SET fontfile=C\:/Users/ADMINI~1/AppData/Local/Temp/video_preview.ttf
SET FFmpeg_path=I:/software/mLauncher/resources/app/public/bin/
SET total_time=
SET PATH=%PATH%;%FFmpeg_path%
IF NOT defined infile ECHO input media file.&PAUSE>NUL&exit /b

setlocal enabledelayedexpansion
SET begin_time=%date:~0,10% %time:~0,11%
SET infile=%infile:"=%
SET tmpImgDir=%TMP%\imgs_%RANDOM%\
IF EXIST %tmpImgDir% rd %tmpImgDir% /S /Q
md %tmpImgDir%
FOR /F "delims=x tokens=1,2" %%i IN ("%size%") DO SET _w=%%i&SET _h=%%j
FOR /F "delims=. tokens=1,2" %%i IN ("%duration%") DO SET _num=%%i&SET _dot=%%j000
SET duration_ms=%_num%%_dot:~0,3%
SET /a sec=%_num%
SET /a tmin=%sec%/60
SET /a tsec=%sec%-%tmin%*60
SET /a thour=%tmin%/60
SET /a tmin=%tmin%-%thour%*60
IF %thour% LEQ 9 (SET thour=0%thour%)
IF %tmin%  LEQ 9 (SET tmin=0%tmin%)
IF %tsec%  LEQ 9 (SET tsec=0%tsec%)
SET /a stepms=%duration_ms%/(%split%+1)
SET /a fontsize=%coded_height%/8
SET /a fontsize2=%fontsize%/4
FOR /L %%i IN (1,1,%split%) DO (
    SET /a pos=%%i*%stepms%
	SET sec=!pos:~0,-3!
	SET dot=!pos:~-3!
	IF not defined sec SET sec=0
	
	SET /a percent=100*%%i/%split%
	echo !percent!%
	SET /a tmin=!sec!/60
	SET /a tsec=!sec!-!tmin!*60
	SET /a thour=!tmin!/60
	SET /a tmin=!tmin!-!thour!*60
	
	IF !thour! LEQ 9 (SET thour=0!thour!)
	IF !tmin!  LEQ 9 (SET tmin=0!tmin!)
	IF !tsec!  LEQ 9 (SET tsec=0!tsec!)
	IF %%i LSS 100 (SET tn=0%%i)
	IF %%i LSS 10  (SET tn=00%%i)
	IF %%i GEQ 100 (SET tn=%%i)

	SET vf=-vf drawtext='fontfile=%fontfile%:x=10:y=h-%fontsize%+%fontsize2%:fontsize=%fontsize%:fontcolor=#f0f0f0:shadowcolor=#303030:shadowx=1:shadowy=1:rate=1:text=!thour!\:!tmin!\:!tsec!:expansion=normal:start_number=0:borderw=0:bordercolor=#303030:box=0:boxcolor=#303030@0.2'
	ffmpeg -ss !sec!.!dot! -v fatal -i "%infile%" -an -y -vframes 1 -s %size% !vf! "%tmpImgDir%!tn!.png"
)
SET allfn=
SET /a iLine=1
dir %tmpImgDir%\*.png /b/w/n/on>%tmpImgDir%_img.txt
FOR /f "eol=# delims=" %%i IN (%tmpImgDir%_img.txt) DO (
SET allfn=!allfn! -i "%%i"
SET /a iLine=!iLine!+1
)
del %tmpImgDir%_img.txt

SET /a iLine=!iLine!-1
SET /a w=%layout%
SET /a h=!iLine!/!w!
SET /a mod=!iLine!-!h!*!w!
IF !mod! NEQ 0 (SET /a h=!h!+1)
SET /a w1=!w!*%_w%
SET /a h1=!h!*%_h%
setlocal disabledelayedexpansion

SET infile=%infile:"=%
pushd %tmpImgDir%
ffmpeg -v fatal %allfn% -filter_complex concat=n=%iLine%,tile=%w%x%h%,scale=%w1%x%h1% "%outFile%" -y
popd
IF EXIST %tmpImgDir% rd %tmpImgDir% /S /Q
exit /b