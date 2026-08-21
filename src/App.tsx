import { useEffect } from 'react';
import { Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PlayerProvider } from './player/PlayerProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { useTheme } from './theme/theme';
import Library from './pages/Library';
import Player from './pages/Player';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Dark palette applied via .ion-palette-dark class on body */
import '@ionic/react/css/palettes/dark.class.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const ThemedApp: React.FC = () => {
  const { theme } = useTheme();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(
        () => undefined
      );
    }
  }, [theme]);

  return (
    <IonApp>
      <PlayerProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route path="/player" element={<Player />} />
            <Route path="/" element={<Library />} />
          </IonRouterOutlet>
        </IonReactRouter>
      </PlayerProvider>
    </IonApp>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <ThemedApp />
  </ThemeProvider>
);

export default App;
