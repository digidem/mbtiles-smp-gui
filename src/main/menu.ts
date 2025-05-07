import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'MbtilesSMP',
      submenu: [
        {
          label: 'About MbtilesSMP',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };

    const subMenuView: MenuItemConstructorOptions = {
      label: 'View',
      submenu:
        process.env.NODE_ENV === 'development' ||
        process.env.DEBUG_PROD === 'true'
          ? [
              {
                label: 'Reload',
                accelerator: 'Command+R',
                click: () => {
                  this.mainWindow.webContents.reload();
                },
              },
              {
                label: 'Toggle Developer Tools',
                accelerator: 'Alt+Command+I',
                click: () => {
                  this.mainWindow.webContents.toggleDevTools();
                },
              },
            ]
          : [
              {
                label: 'SMP Viewer',
                click() {
                  shell.openExternal('https://smp-viewer.pages.dev');
                },
              },
            ],
    };

    const subMenuLearn: MenuItemConstructorOptions = {
      label: 'Learn More',
      submenu: [
        {
          label: 'About CoMapeo',
          click() {
            shell.openExternal('https://comapeo.app/');
          },
        },
        {
          label: 'About Awana Digital',
          click() {
            shell.openExternal('https://awana.digital/');
          },
        },
      ],
    };

    const template = [subMenuAbout, subMenuView, subMenuLearn];

    return template;
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Quit',
            accelerator: 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
                {
                  label: 'SMP Viewer',
                  click() {
                    shell.openExternal('https://smp-viewer.pages.dev');
                  },
                },
              ]
            : [
                {
                  label: 'SMP Viewer',
                  click() {
                    shell.openExternal('https://smp-viewer.pages.dev');
                  },
                },
              ],
      },
      {
        label: 'Learn more',
        submenu: [
          {
            label: 'About CoMapeo',
            click() {
              shell.openExternal('https://comapeo.app/');
            },
          },
          {
            label: 'About Awana Digital',
            click() {
              shell.openExternal('https://awana.digital/');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
