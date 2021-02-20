// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('path')
const { writeFile } = require('fs');

let win;

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html');

  // Open the DevTools.
  win.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


selectSaveFile = () => {
  const options = {
    title: 'Select Save File',
    buttonLabel: 'Select File',
  };

  return dialog.showSaveDialogSync();
};

ipcMain.on("toMain", (event, args) => {
  switch (args.event) {
    case 'selectSaveFile': 
      const saveFile = selectSaveFile();
      console.log("send filename to renderer", saveFile);
      win.webContents.send("fromMain", { event: 'selectSaveFile', data: { saveFile } });
      break;

    case 'saveFile':
      const saveData = JSON.stringify(args.data.segments);
      writeFile(args.data.saveFile, saveData, (err, data) => {
        console.error(err);
      });
      break;

    default:
      console.warn("Unknown event: ", args);
  }
});