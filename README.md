# ONYX Mobile

**ONYX** is a local-first mobile trading journal built with React Native and Expo. It helps traders track trades, manage a portfolio, analyze performance, and build disciplined strategies — all with data stored on-device for full privacy.

## Features

- **Trade Journaling** — Log entries/exits, attach chart screenshots, and tag setups with custom model labels.
- **Portfolio Tracker** — Track crypto and traditional investments with live price updates via CoinLore.
- **Strategy Management** — Create, switch, and compare multiple trading strategies.
- **Performance Analytics** — Win rate, profit factor, expectancy, equity curves, and P&L calendars.
- **Data Portability** — Full JSON backup/restore with embedded images; PDF report generation.
- **Biometric Lock** — Optional fingerprint/face unlock for privacy.
- **Offline-First** — All data persisted locally with AsyncStorage and the device file system.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Expo SDK **52+**
- (Optional) [EAS CLI](https://docs.expo.dev/build/introduction/) for cloud builds

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/samiabat/onyx-mobile.git
   cd onyx-mobile
   ```

2. **Install dependencies**

   ```bash
   npm install
   npx expo install
   ```

3. **Start the development server**

   ```bash
   npx expo start
   ```

   From here you can open the app on an Android emulator, iOS simulator, or a physical device via Expo Go.

## Build Commands

### Local Android build

```bash
npx expo prebuild --clean --platform android
```

### Production build via EAS

```bash
eas build -p android --profile production
```

## Project Structure

```
app/          — Screens & navigation (Expo Router file-based routing)
components/   — Reusable UI components
hooks/        — Custom React hooks (trade data, portfolio, file system, biometrics)
services/     — External API integrations (CoinLore, PDF generation)
utils/        — Pure utility/calculation functions
constants/    — App-wide configuration and theme definitions
assets/       — Images, fonts, and static resources
```

## License

This project is private and not currently published under an open-source license.
