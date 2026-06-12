// Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyAl0muwUmlGHBFbAimK3IqmwrZhBlOCch0",
    authDomain: "shuangho-volunteer.firebaseapp.com",
    projectId: "shuangho-volunteer",
    storageBucket: "shuangho-volunteer.firebasestorage.app",
    messagingSenderId: "854570601633",
    appId: "1:854570601633:web:3621768f83b622d36b34e0"
};

// 初始化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
