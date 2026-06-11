const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// 🔥 FULL PASARAN
const PASARAN = {
  "m17": "TOTO MACAU 4D",
  "m51": "TOTO MACAU 5D",
  "m83": "KINGKONG 4D",
  "p13863": "TOTO BEIJING",
  "p13852": "CHINA",
  "p13851": "CAMBODIA",
  "p13855": "HONGKONG",
  "p13860": "SINGAPORE",
  "p13862": "TAIWAN",
  "p13861": "SYDNEY",
  "p13859": "ROMA",
  "p13856": "MADRID",
  "p28515": "JEJULOTTO",
  "p28516": "TOTO FUZHOU",
  "p30102": "TAICHUNG",
  "p30100": "KOWLOON",
  "p30097": "CHONGQING",
  "p30095": "CHENGDU",
  "p30093": "FOSHAN",
  "p30092": "ECUADOR",
  "p30091": "CUBA",
  "p30090": "MONACO",
  "p28518": "TORONTO",
  "p28517": "BHUTAN",
  "p28514": "LAOS",
  "p28513": "HUNGARY",
  "p28512": "BULGARIA",
  "p18913": "CALIFORNIA",
  "p18909": "OREGON 12",
  "p18910": "OREGON 09",
  "p18912": "OREGON 06",
  "p18911": "OREGON 03",
  "p18902": "NEWYORK MID",
  "p18901": "NEWYORK EVE",
  "p18903": "FLORIDA MID",
  "p18904": "FLORIDA EVE",
  "p18906": "KENTUCKY MID",
  "p18905": "KENTUCKY EVE",
  "p18908": "CAROLINA DAY",
  "p18907": "CAROLINA EVE",
  "p13857": "MIAMI",
  "p13858": "PHILIPPINES",
  "p13853": "CYPRUS",
  "p13854": "GUANGDONG",
  "p13864": "TURIN",
  "p15472": "JAPAN",
  "p15473": "ICELAND",
  "p30531": "OSLO",
  "p30527": "ITALY",
  "p30528": "FRANCE",
  "p30529": "CHILE",
  "p30530": "MEXICO",
  "p30105": "DENVER",
  "p30104": "HAITI"
};

let cache = {};

// 🔄 SCRAPE FINAL
async function scrape(kode) {
  try {
    const url = `https://kartuhappy.com/history/result/${kode}/kosong`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const todayStr = new Date().toISOString().split("T")[0];

    let found = null;

    $("table tbody tr").each((i, el) => {

      const cols = $(el).find("td");

      let tanggalText = "";
      let angka = "";

      // 🔥 NORMAL
      if (!kode.startsWith("m")) {
        tanggalText = cols.eq(2).text().trim();
        angka = cols.eq(3).text().trim();
      } 
      // 🔥 MACAU FIX
      else {
        tanggalText = cols.eq(1).text().trim();
        angka = cols.eq(2).text().trim();
      }

      if (!tanggalText || !angka) return;

      let [tanggal, jam] = tanggalText.split("|").map(x => x.trim());

      if (!tanggal) return;

      if (tanggal === todayStr) {
        found = { tanggal, jam, angka };
        return false;
      }
    });

    // ❌ BELUM ADA
    if (!found) {
      cache[kode] = {
        kode,
        pasaran: PASARAN[kode],
        angka: "",
        tanggal: null,
        jam: null,
        status: "MENUNGGU",
        waktuLalu: "-",
        updated: new Date()
      };
      return;
    }

    const { tanggal, jam, angka } = found;

    // 🔥 HITUNG MANUAL TIME (ANTI BUG)
    const now = new Date();
    const nowWIB = new Date(now.getTime() + (7 * 60 * 60 * 1000));

    let waktuLalu = "-";
    let diffMinutes = 0;

    if (jam) {
      const [h, m] = jam.split(":").map(Number);

      const resultMinutes = h * 60 + m;
      const nowMinutes = nowWIB.getHours() * 60 + nowWIB.getMinutes();

      diffMinutes = nowMinutes - resultMinutes;
      if (diffMinutes < 0) diffMinutes += 1440;

      if (diffMinutes < 1) {
        waktuLalu = "baru saja";
      } 
      else if (diffMinutes < 60) {
        waktuLalu = `${diffMinutes} menit lalu`;
      } 
      else {
        const jamnya = Math.floor(diffMinutes / 60);
        const sisamenit = diffMinutes % 60;

        waktuLalu = sisamenit === 0
          ? `${jamnya} jam lalu`
          : `${jamnya} jam ${sisamenit} menit lalu`;
      }
    }

    const newData = {
      kode,
      pasaran: PASARAN[kode],
      angka,
      tanggal,
      jam,
      status: "SUDAH",
      selisihMenit: diffMinutes,
      waktuLalu,
      updated: new Date()
    };

    const old = cache[kode];
    cache[kode] = newData;

    // 🔥 REALTIME PUSH
    if (!old || old.angka !== newData.angka) {
      io.emit("update", newData);
      console.log("🔥 UPDATE:", kode, angka);
    }

  } catch (err) {
    console.log("Error:", kode);
  }
}

// 🔁 LOOP REALTIME
setInterval(() => {
  Object.keys(PASARAN).forEach(scrape);
}, 2000);

// API
app.get("/api", (req, res) => {
  res.json(cache[req.query.kode] || {});
});

// SOCKET
io.on("connection", (socket) => {
  socket.emit("init", cache);
});

// START
server.listen(PORT, () => {
  console.log("🚀 Backend realtime aktif");
});
