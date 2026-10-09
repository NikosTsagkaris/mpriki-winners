# ☕ Mpriki Winners - QR Reward & Giveaway Web App

[![Live App](https://img.shields.io/badge/Live_App-mpriki--winners.web.app-amber?style=for-the-badge&logo=firebase)](https://mpriki-winners.web.app)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Hosting-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Εφαρμογή επιβράβευσης πελατών και 15νθήμερων κληρώσεων για το καφέ **«Μπρίκι»**, άμεσα διασυνδεδεμένη με το σύστημα παραγγελιοληψίας και εκτύπωσης αποδείξεων POS (**GoldenGoosePDA**).

---

## 🎁 3 Επίπεδα Επιβράβευσης Πελατών

Η εφαρμογή συνδυάζει 3 διαφορετικούς μηχανισμούς ανταμοιβής για κάθε παραγγελία Take Away:

1. ⚡ **Στιγμιαίος Δωρεάν Καφές:** Αυτόματο κέρδος **κάθε 30 καφέδες** που εκτυπώνονται στο POS.
2. 🎯 **Κουπόνι "Καφές 1+1":** Εξαργύρωση **κάθε 50 πόντους** (10 καφέδες) μέσα από το προφίλ χρήστη.
3. 🎲 **15νθήμερη Μεγάλη Κλήρωση:** **6 μεγάλα δώρα** (Γυαλιά Ηλίου, Bluetooth Headphones, Powerbanks) με λαχνούς από κάθε σκανάρισμα.

---

## 🌟 Αναλυτικές Λειτουργίες

### 1. ⚡ Στιγμιαίος Δωρεάν Καφές (Κάθε 30 Καφέδες στο POS)
* **Κυκλικός Μετρητής POS:** Ο server παραγγελιοληψίας παρακολουθεί τους καφέδες Take Away και εκτυπώνει στην απόδειξη αρίθμηση κύκλου: `ΚΑΦΕΣ #1` έως `ΚΑΦΕΣ #30`.
* **Τυχερό QR Code:** Στον 30ό καφέ (`counter_num % 30 == 0`), ο εκτυπωτής παράγει αυτόματα QR code με πρόθεμα **`MPRIKI-COFFEE-...`**.
* **Άμεση Ειδοποίηση Νικητή:** Κατά το σκανάρισμα στο Web App, εμφανίζεται άμεσα modal:
  > **🎉 ΑΜΕΣΟΣ ΝΙΚΗΤΗΣ! Δωρεάν Καφές**  
  > **ΚΩΔΙΚΟΣ ΕΞΑΡΓΥΡΩΣΗΣ: `MPRIKI-XXXX`**  
  > *(Ο πελάτης δείχνει τον κωδικό στο ταμείο και λαμβάνει άμεσα 1 δωρεάν καφέ).*
* **Extra Bonus:** Ο νικητής λαμβάνει ταυτόχρονα **+1 Συμμετοχή** στη Μεγάλη Κλήρωση και **+5 Πόντους**!

### 2. 🎯 Σύστημα Πόντων & Εξαργύρωση (50 Πόντοι)
* **Απόδοση Πόντων:** Κάθε έγκυρο σκανάρισμα προσφέρει **+5 πόντους επιβράβευσης**.
* **Εξαργύρωση στους 50 Πόντους:** Μόλις ο χρήστης συγκεντρώσει 50 πόντους (10 καφέδες), ενεργοποιείται το κουμπί **«ΕΞΑΡΓΥΡΩΣΗ ΚΟΥΠΟΝΙΟΥ "ΚΑΦΕΣ 1+1" (50 ΠΟΝΤΟΙ)»**.
* **Έκδοση Κουπονιού:** Αφαιρούνται 50 πόντοι από το υπόλοιπο (`rewardPoints - 50`) και δημιουργείται νέο κουπόνι `MPRIKI-1PLUS1-XXXX` στο ιστορικό δώρων του χρήστη με διάρκεια ισχύος 10 ημερών.

### 3. 📷 Σκανάρισμα QR Αποδείξεων
* **Real-time Camera Scanner:** Σάρωση QR codes μέσω κάμερας συσκευής (βιβλιοθήκη `html5-qrcode`).
* **Εναλλακτικό Ανέβασμα Φωτογραφίας:** Δυνατότητα επιλογής φωτογραφίας από τη συλλογή (file input).
* **Προστασία Anti-Duplicate:** Κάθε QR code απόδειξης μαρκάρεται ως `redeemed: true` μέσω Cloud Firestore atomic transactions για αποφυγή διπλοχρήσης.

### 4. 🎲 15νθήμερη Μεγάλη Κλήρωση (6 Νικητές)
* Αυτόματη ή χειροκίνητη διεξαγωγή ανά 14 ημέρες μεταξύ όλων των ενεργών λαχνών.
* **Μεγάλα Δώρα ανά Κύκλο:**
  1. 🕶️ **1ος Νικητής:** 1 Ζευγάρι Γυαλιά Ηλίου
  2. 🕶️ **2ος Νικητής:** 1 Ζευγάρι Γυαλιά Ηλίου
  3. 🎧 **3ος Νικητής:** HOCO BLUETOOTH W35
  4. 🔋 **4ος Νικητής:** ENERGENIE 20W Fast Charging Powerbank 20000 mAh
  5. 🔋 **5ος Νικητής:** GEMBIRD Solar Powerbank 10000 mAh
  6. 🔋 **6ος Νικητής:** Anker Zolo Powerbank 10000 mAh
* Ζωντανή αντίστροφη μέτρηση (Countdown) στο προφίλ του χρήστη.

### 5. 🏆 Πίνακας Νικητών (Leaderboard)
* Real-time παρακολούθηση των νικητών από τη συλλογή `weekly_winners` στο Firestore.
* Αυτόματη απόκρυψη ευαίσθητων στοιχείων (privacy masking π.χ. `N***s`).

### 6. 👑 Admin Console
* Πρόσβαση με κωδικό διαχειριστή.
* Live έλεγχος σύνδεσης POS Server (`http://192.168.1.50:8000/orders/stats`).
* Πλήρης κατάλογος χρηστών με αναζήτηση, πόντους, συμμετοχές και status εξαργύρωσης δώρων.
* Διεξαγωγή κλήρωσης και πλήρης μηδενισμός κύκλου συμμετοχών.

### 7. 🔒 Ασφάλεια & GDPR
* Σύνδεση με **Google Sign-In** & **Email/Password** μέσω Firebase Auth.
* Όροι χρήσης, πολιτική απορρήτου, όριο ηλικίας 18+ και δικαίωμα διαγραφής (`info@ntvelop.gr`).
* 10ήμερη διάρκεια ισχύος κερδισμένων δώρων.

---

## 🛠️ Τεχνολογικό Stack

| Τομέας | Τεχνολογία |
| :--- | :--- |
| **Frontend Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Styling** | Tailwind CSS |
| **Authentication** | Firebase Authentication (Google OAuth & Email/Pass) |
| **Database** | Cloud Firestore (Real-time listeners & atomic transactions) |
| **Hosting** | Firebase Hosting |
| **QR Scanner** | html5-qrcode |
| **Μονετοποίηση** | Google AdSense |

---

## 📁 Δομή Αρχείων Project

```text
cool-archimedes/
├── dist/                     # Έτοιμο παραγωγικό build για deployment
├── src/
│   ├── components/
│   │   ├── AdminTab.jsx      # Πίνακας ελέγχου διαχειριστή & κληρώσεις
│   │   ├── AuthScreen.jsx    # Οθόνη εισόδου/εγγραφής & όροι GDPR
│   │   ├── LeaderboardTab.jsx# Λίστα νικητών κληρώσεων
│   │   ├── ProfileTab.jsx    # Προφίλ, πόντοι, εξαργύρωση 50π, αντίστροφη μέτρηση
│   │   └── ScannerTab.jsx    # Σαρωτής QR (COFFEE άμεσος νικητής & ENTRY)
│   ├── firebase.js           # Ρυθμίσεις Firebase & υπολογισμός κύκλου κληρώσεων
│   ├── App.jsx               # Κεντρικό shell εφαρμογής & κάτω μπάρα πλοήγησης
│   └── main.jsx              # Entry point React
├── index.html                # Βασικό HTML template (Tailwind CDN, AdSense)
├── package.json              # Εξαρτήσεις & scripts
├── vite.config.js            # Ρυθμίσεις Vite & React plugin
├── firebase.json             # Ρύθμιση Firebase Hosting SPA rewrites
└── .firebaserc               # Firebase project target (mpriki-winners)
```

---

## 🚀 Οδηγός Εγκατάστασης & Εκτέλεσης

### Προαπαιτούμενα
* [Node.js](https://nodejs.org/) (Έκδοση LTS 18+)
* [Git](https://git-scm.com/)

### 1. Κλωνοποίηση του Αποθετηρίου
```bash
git clone https://github.com/NikosTsagkaris/mpriki-winners.git
cd mpriki-winners
```

### 2. Εγκατάσταση Εξαρτήσεων
```bash
npm install
```

### 3. Τοπική Εκτέλεση (Development)
```bash
npm run dev
```
Η εφαρμογή θα ξεκινήσει τοπικά στη διεύθυνση `http://localhost:5173`.

### 4. Build & Deployment στο Firebase Hosting
```bash
# Δημιουργία παραγωγικού bundle
npm run build

# Ανέβασμα στο Firebase
npx firebase deploy --only hosting
```

---

## 👨‍💻 Δημιουργός
* **Ανάπτυξη:** Nikos Tsagkaris ([@NikosTsagkaris](https://github.com/NikosTsagkaris))
* **Υποστήριξη / Επικοινωνία:** [info@ntvelop.gr](mailto:info@ntvelop.gr)
