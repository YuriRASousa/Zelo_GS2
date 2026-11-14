@echo off
REM Sobe a API do Zelo na porta 8080. Compila antes se o .jar ainda nao existir.
cd /d "%~dp0..\backend\zelo-api"
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot" set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
if not exist target\zelo-api-1.0.0.jar call mvnw.cmd -q -DskipTests package
if defined JAVA_HOME (
  "%JAVA_HOME%\bin\java.exe" -jar target\zelo-api-1.0.0.jar
) else (
  java -jar target\zelo-api-1.0.0.jar
)
