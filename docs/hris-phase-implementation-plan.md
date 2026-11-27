# Rencana Implementasi HRIS per Fase

Sumber acuan: `docs/hris-roadmap.md`. Dokumen ini adalah turunan teknisnya: apa yang dikerjakan, di file mana, dengan urutan commit dan gerbang rilis yang jelas.

Ditulis setelah pembacaan kode pada commit `77e7ab7`. Status: **Fase 0–2 sudah diimplementasikan; Fase 3–5 masih rencana.**

Setiap fase yang mengubah kontrak API wajib memperbarui dokumentasi FE di `docs/fe-integration-guide.md` dan/atau `docs/leaves-api.md` pada perubahan yang sama. Jangan menunda sampai fase berikutnya.

Estimasi berlaku untuk satu developer penuh waktu, hari kerja, dan sengaja dibuat kasar. Angka itu untuk memutuskan urutan, bukan untuk komitmen ke pelanggan.

---

## 0. Koreksi terhadap roadmap

Tiga hal di roadmap ternyata berbeda setelah kode dibaca sampai controller dan model. Perbaiki roadmap sebelum plan ini dipakai sebagai kontrak kerja.

| # | roadmap bilang | kenyataannya di kode | akibat |
|---|---|---|---|
| 1 | Tier 0: "`get-me` kembalikan list permission" sebagai pekerjaan belum selesai | Sudah selesai. `src/modules/auth/controller.js:99-124` memanggil `getUserPermissionKeys` dan `login` pun sudah mengembalikan `permissions` (`controller.js:72-78`). README §4 dan §"Next Features" yang basi, bukan kodenya. | Item itu keluar dari daftar kerja. Yang tersisa hanya memperbaiki README. |
| 2 | Tidak membahas relasi User ↔ Employee sama sekali | **Tidak ada.** `db/models/user.js` hanya punya `role_id`. Tidak ada `employee_id` di tabel users, tidak ada asosiasi ke Employee. | Ini blocker keras. Lihat Fase 0. |
| 3 | §3 memakai `attendance_logs.created_by` tanpa menyebut bentuknya | `audit_logs.user_id` `allowNull: false` dengan FK ke users, dan `createAuditLog` (`src/utils/auditLog.js:17-24`) jatuh ke fallback berbahaya: bila `userId` kosong, ia mencari **user apa pun** dan menuliskan audit atas namanya. | Semua kerja scheduler dan aksi sistem akan tercatat atas nama pengguna acak. Harus dibenahi sebelum scheduler pertama. |

Tiga temuan tambahan yang tidak mengubah desain tapi mengubah pekerjaan:

4. **`src/utils/helper.js` adalah bom waktu.** Ia mengimpor `rate-limit-redis` dan `../../config/redis`. Keduanya tidak ada: `rate-limit-redis` tidak terpasang dan `config/` hanya berisi `config.js`. File itu tidak meledak sekarang hanya karena tidak ada yang mengimpornya. `src/utils/redis.js` mati dengan sebab yang sama. Yang benar-benar dipakai semua modul adalah `src/utils/limiter.js` (memory store).
5. **`duration_days` cuti adalah input klien**, bukan hasil hitung. `src/modules/leaves/schema.js:36` menerimanya sebagai `positiveNumber` dari body. Angka itu yang memotong saldo cuti. Selama libur nasional dan shift belum ada, ini hanya tidak akurat; setelah Fase 3 berjalan, ini menjadi celah — karyawan bisa menyatakan 1 hari untuk rentang 5 hari kerja. Fase 2 harus menghitung durasi di server.
6. **`validationFiles` sudah ada** di `src/utils/validation.js:40-92` dan sudah memvalidasi MIME plus ukuran. Fase 5 tidak perlu menulis validator upload baru. `src/utils/csrf.js` mengimpor `csurf` yang tidak terpasang dan tidak diimpor di mana pun — file mati, dan proteksi CSRF memang tidak dibutuhkan karena cookie sudah `httpOnly` + `sameSite: 'strict'` (`auth/controller.js:65-70`).

---

## 1. Konvensi yang harus dipatuhi setiap fase

Semua fase mengikuti pola yang sudah ada. Menyimpang dari ini berarti pekerjaan tambahan tanpa manfaat.

**Struktur modul.** `src/modules/<nama>/{index.js,controller.js,schema.js}`. Router memasang `router.use(limiter)` lalu `router.use(authMiddleware)` di atas, kemudian tiap rute dibungkus `requirePermission('<key>')`. Contoh acuan: `src/modules/leaves/index.js`.

**Controller.** Kelas statis, satu `static async` per aksi, seluruh badan dibungkus `try/catch` dengan `return next(err)`. Response selalu `res.status(HttpStatusCode.X).json(api(data, HttpStatusCode.X, { req }))` — `api()` di `src/utils/api.js` yang mengubah `{ rows, count }` atau `{ data, page, per_page, count }` menjadi envelope ber-`metadata` paginasi. Ikuti itu; jangan bangun envelope baru.

**Error.** Dilempar sebagai object literal `{ code: HttpStatusCode.X, message: '...' }`. `src/middleware/errorMiddleware.js` membaca `err.statusCode ?? err.status ?? err.code`, jadi `code` berfungsi. Pakai 409 untuk bentrok state (duplikat, sudah ditutup, tidak boleh diubah) seperti yang sudah dilakukan modul leaves.

**Validasi.** Zod di `schema.js`, dipanggil lewat `validateRequest(schema, req)`. Pola `update` = `create.partial().refine(payload => Object.keys(payload).length > 0)`. Acuan: `src/modules/leaves/schema.js`.

**Dokumentasi FE.** Setiap perubahan yang terlihat frontend — field baru, endpoint baru, status baru, permission baru, breaking change — masuk ke `docs/fe-integration-guide.md` (auth, user, notifikasi, audit) atau `docs/leaves-api.md` (cuti). Tulis di commit yang sama, bukan setelah fase selesai.

**Model & migrasi.** `db/models/<kebab>.js` dengan `underscored: true`, `paranoid: true` bila soft delete, nama field snake_case eksplisit, `id` STRING default `cuid()`. Migrasi Sequelizer di `db/migrations/` (`.sequelizerc` sudah menunjuk ke sana). Index unik aktif memakai pola partial index `WHERE deleted_at IS NULL` yang sudah dipakai `2026109000001-soft-delete-active-unique-indexes.js`.

**Seeder permission.** Ikuti pola idempoten `db/seeders/2026108070001-demo-permission-seeder.js`: ambil key yang sudah ada, filter, `bulkInsert`. Jangan pernah `INSERT` buta — seeder akan dijalankan ulang di lingkungan yang sudah berisi data.

**OpenAPI.** `src/docs/openapi.js` punya helper `query(...)` dan komponen skema. Tiap fase menambah path dan skema di sana, sekaligus menutup butir roadmap §8 tentang dokumentasi permission per endpoint.

**Test.** Runner bawaan `node --test` (`npm test`). Tidak ada supertest dan tidak ada DB test: `test/rbac.test.js` menguji middleware dengan memonkey-patch `db.User.findByPk`, dan `test/*-schema.test.js` menguji fungsi murni. **Konsekuensi penting:** logika perhitungan apa pun (durasi cuti, tanggal bisnis, payroll) harus hidup di fungsi murni pada `schema.js` atau file service terpisah, bukan di dalam controller, supaya bisa diuji tanpa database. Ini aturan wajib untuk Fase 2, 3, dan 4.

**Urutan commit per fase.** migrasi → model + asosiasi → seeder permission → schema (validasi + fungsi murni) → test fungsi murni → service/calculator → controller → routes → OpenAPI → seeder demo → README. Commit kecil per lapis, bukan satu commit raksasa.

---

## 2. Fase 0 — Tautan User ↔ Employee, aktor sistem, bersih-bersih

**Durasi: 2–3 hari. Ini fase wajib pertama. Fase 2, 3, 4, 5 tidak bisa dimulai sebelum ini selesai.**

### Kenapa ada fase baru ini

Empat fase berikutnya semuanya butuh menjawab satu pertanyaan: "user yang sedang login ini karyawan yang mana?"

- Fase 2: atasan langsung adalah `employees.manager_id`, sedangkan yang menekan tombol approve adalah seorang `user`. Tanpa tautan, "hanya atasan yang boleh memutuskan" tidak bisa ditegakkan.
- Fase 3: `attendance.record_self` dan `attendance.read_self` harus mengetahui baris karyawan pemanggil.
- Fase 4: `payroll.payslip.read_self` — tanpa tautan, endpoint ini hanya bisa dibuat dengan menebak, dan tebakan yang salah adalah kebocoran horizontal.
- Fase 5: seluruh ESS berdiri di atas tautan itu.

Roadmap tidak membahas ini karena roadmap disusun dari daftar modul, bukan dari skema. Membangun absensi tanpa tautan berarti membangun endpoint `*_self` yang menebak-nebak identitas, lalu memigrasinya sesudah data kehadiran terkumpul — jauh lebih mahal.

### Pengerjaan

**2.1 Migrasi `add-employee-id-to-users`.**
Kolom `employee_id` STRING nullable, FK ke `employees(id)`. Unique partial index: `ON users (employee_id) WHERE deleted_at IS NULL AND employee_id IS NOT NULL` — satu user per karyawan, sejalan dengan pola unique-aktif yang sudah dipakai repo ini.

**2.2 Backfill.**
Cocokkan `lower(trim(users.email))` dengan `lower(trim(employees.email))`. Buat migrasi yang menuliskan hasil ketidakcocokan ke tabel `job_runs` atau mengembalikan daftar lewat skrip `src/scripts/link-users-employees.js` yang bisa dijalankan dengan `--dry-run`. Jangan backfill dengan menebak dari nama — nama duplikat.

Setelah backfill, validasi: setiap user dengan role `EMPLOYEE` wajib punya `employee_id`. Yang tidak, dilaporkan, bukan dipaksa.

**2.3 Asosiasi model.**
`User.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' })` dan `Employee.hasOne(models.User, { foreignKey: 'employee_id', as: 'user' })`. Ikuti gaya `db/models/employee.js` yang sudah menaruh asosiasi di `associate()`.

**2.4 Helper resolusi identitas.**
`src/utils/employeeContext.js`:

```js
resolveEmployeeId(userId)        // cached per proses, bukan per request
requireEmployeeId(req)           // throw { code: 409 } bila user tidak tertaut
```

Dipakai di semua endpoint `*_self`. Aturan: tolak dengan 409 dan pesan eksplisit, jangan kembalikan data kosong — respons kosong membuat frontend salah menyimpulkan karyawan tidak punya data, padahal tautannya yang hilang.

**2.5 Perbaiki `createAuditLog`.**
Ini perubahan keamanan data, bukan kenyamanan. Fallback saat ini (`auditLog.js:17-24`) menulis audit atas nama pengguna acak. Hapus fallback itu.

- Migrasi `alter-audit-logs-actor`: `user_id` jadi nullable, tambah `actor_type` ENUM(`'USER'`,`'SYSTEM'`) default `'USER'`, tambah `actor_label` STRING nullable (misal `'scheduler:leave-escalation'`).
- `createAuditLog` mewajibkan salah satu dari `userId` atau `actorType: 'SYSTEM'`. Bila keduanya kosong → **throw**, bukan `return null`. Versi sekarang diam-diam mengembalikan `null` saat tidak ada user, dan itu berarti jejak audit hilang tanpa siapa pun tahu. Untuk payroll dan dokumen, kehilangan jejak audit tidak bisa diterima.
- Test: `test/audit-log.test.js` menutup tiga kasus — user biasa, sistem, dan kosong-ditolak.

**2.6 Bersih-bersih kode mati.**
Hapus `src/utils/redis.js`, `src/utils/helper.js`, `src/utils/csrf.js`. Ketiganya tidak ter-impor dan dua di antaranya akan melempar `MODULE_NOT_FOUND` begitu diimpor. Mempertahankannya berarti membiarkan orang lain mengira ada lapisan cache dan rate-limit Redis yang siap pakai.

Catatan di README: rate limit memakai memory store (`limiter.js`), jadi batasnya per instance dan reset saat restart. Untuk skala di bawah 50 karyawan itu cukup; kalau instance bertambah, baru pasang Redis + `rate-limit-redis`.

### Gerbang rilis

- [ ] Migrasi jalan di staging tanpa kehilangan user.
- [ ] Daftar user role `EMPLOYEE` tanpa `employee_id` = kosong atau diketahui alasannya.
- [ ] `createAuditLog` menolak menulis tanpa aktor; tidak ada lagi audit atas nama pengguna acak.
- [ ] `npm test` hijau, `test/audit-log.test.js` ada.
- [ ] Tiga file mati terhapus dan tidak ada import yang pecah.

---

## 3. Fase 1 — Fondasi: sesi, scheduler, notifikasi

**Durasi: 6–8 hari. Bergantung pada Fase 0 hanya untuk `actor_type` scheduler; tidak butuh tautan employee.**

Roadmap menaruh ini di Tier 0 dengan alasan yang benar: semua fase berikutnya memakainya. Fase 1 adalah satu-satunya fase yang tidak menghasilkan fitur terlihat, jadi godaan untuk melompat ke absensi akan besar. Tahan.

### 3.1 Refresh token + revocation sesi

Kondisi sekarang: JWT 7 hari di cookie HttpOnly, `logout` hanya `res.clearCookie('token')` (`auth/controller.js:88-97`). Token yang dicuri tetap hidup 7 hari dan tidak ada cara mematikan sesi dari server.

Tanpa Redis (Fase 0 menghapus jalurnya), penyimpanan sesi tetap di Postgres.

**Migrasi `create-user-sessions`:** `id`, `user_id` FK, `refresh_token_hash` unique (SHA-256 dari token acak 256 bit, jangan simpan mentah), `expires_at`, `revoked_at` nullable, `replaced_by_session_id` nullable, `user_agent`, `ip_address`, `last_used_at`, `created_at`.

**Perilaku:**
- Access token dipendekkan jadi **15 menit**, payload `{ userId, employeeId, role, status, sessionId }`. `role` dan `status` di payload hanya untuk kenyamanan; `requirePermission` sudah memuat ulang dari DB dan tetap jadi sumber kebenaran. Jangan menghapus reload itu — itulah yang membuat user yang dinonaktifkan langsung terblokir.
- Refresh token di cookie sendiri: `refresh_token`, `httpOnly`, `sameSite: 'strict'`, `secure` di production, `path: '/api/v1/auth'`. Batasi ke path supaya tidak terkirim ke endpoint lain.
- `POST /api/v1/auth/refresh` — rotasi: sesi lama di-`revoked_at` dan diisi `replaced_by_session_id`, sesi baru dibuat. Ini memberi deteksi replay gratis: refresh token yang sudah dipakai ulang berarti dicuri.
- **Replay → matikan seluruh rantai.** Bila refresh token yang sudah dirotasi dipakai, revoke semua sesi user itu dan laporkan ke audit log. Ini bagian yang biasanya dilewatkan dan langsung menghilangkan manfaat rotasi.
- `POST /api/v1/auth/logout` — revoke sesi aktif, baru clear cookie. Perbedaan kecil dari sekarang, efek besar.
- `GET /api/v1/auth/sessions` dan `DELETE /api/v1/auth/sessions/:id/revoke` — pengguna mematikan perangkat lain sendiri. Butuh `employee_id` tidak; cukup `user_id`.

**Endpoint baru:** `POST /auth/refresh`, `GET /auth/sessions`, `DELETE /auth/sessions/:id/revoke`. Logout tetap di path lama supaya frontend tidak pecah.

**Test (fungsi murni, tanpa DB):** rotasi menolak token bekas, replay mencabut seluruh rantai, `expires_at` dihormati, logout tanpa sesi aktif tidak melempar.

### 3.2 Scheduler

Dependency baru: `node-cron`. Satu instance Railway, di bawah 50 karyawan — ini cukup, dan BullMQ tidak dibangun (roadmap §11).

**Bootstrap:** `src/jobs/index.js` mengekspor `startJobs()` yang dipanggil dari `index.js` setelah `server.listen`. Jangan daftarkan job di dalam modul — akan mendaftarkan ganda setiap kali `app` di-import test.

**Idempotensi lewat tabel `job_runs`:** `id`, `name`, `status` (`RUNNING`/`SUCCESS`/`FAILED`), `started_at`, `finished_at`, `error`, `detail` JSONB. Unique partial index `ON job_runs (name) WHERE status = 'RUNNING'`. Sebuah job mengunci dirinya dengan `INSERT` sebelum jalan; bila bentrok 409/unique, ia lewat. Ini lebih baik daripada `pg_try_advisory_lock` karena lock advisory terikat koneksi pool dan dilepas saat koneksi kembali, sehingga tidak benar-benar mencegah tumpang tindih antar proses.

`withLock(name, fn)` hidup di `src/jobs/withLock.js` sebagai fungsi murni-ish (terima model) supaya bisa diuji.

**Job pertama (bukti konsep):** `session-cleanup` harian, menghapus sesi `expires_at < now() - 30 hari` atau sudah revoked. Kecil, nyata, aman dijalankan berulang.

Tulis di kode: `shortcut: node-cron asumsinya satu instance; kalau Railway menambah replika, pindah ke BullMQ + Redis supaya job tidak jalan duplikat.`

### 3.3 Notifikasi

**Migrasi `create-notifications`:** `id`, `user_id` FK nullable, `employee_id` FK nullable, `type` (STRING, misal `leave.pending_level1`), `title`, `body`, `entity_type`, `entity_id`, `data` JSONB, `read_at` nullable, `created_at`, `deleted_at` (paranoid, konsisten modul lain).

**Migrasi `create-notification-outbox`:** `id`, `notification_id` FK, `channel` (`IN_APP`/`EMAIL`), `status` (`PENDING`/`SENT`/`FAILED`), `attempts` default 0, `last_error`, `next_attempt_at`, `sent_at`.

Pola **transactional outbox**: satu transaksi menulis baris `notifications` + baris `outbox`. Tidak ada pengiriman email di dalam request. Alasannya sederhana dan nyata — SMTP lambat atau mati tidak boleh membuat `decideLeaveRequest` gagal 500 setelah saldo cuti sudah terpotong.

- `src/modules/notification/service.js` mengekspor `notify({ userId, employeeId, type, title, body, entity, channels, transaction })`. Menerima `transaction` supaya pemanggil bisa menggabungkannya dengan tulisannya sendiri — ini penting di Fase 2, keputusan cuti dan notifikasi harus atomik.
- Job `outbox-drain` tiap menit, backoff eksponensial (`next_attempt_at = now + 2^attempts menit`), maksimal 5 percobaan lalu `FAILED` permanen.
- Email: `nodemailer` dengan konfigurasi SMTP generik dari env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Roadmap §9.2 poin 4 menunda pilihan provider; SMTP standar adalah jawaban yang tidak mengunci vendor dan bisa diarahkan ke Resend, SES, atau Mailgun belakangan tanpa mengubah kode.
- In-app: `GET /api/v1/notifications` + `PATCH /api/v1/notifications/:id/read` + `PATCH /api/v1/notifications/read-all`. Permission: cukup `authMiddleware`, tanpa `requirePermission` — pengguna melihat notifikasinya sendiri. Ini endpoint `*_self` pertama dan contoh pola cek kepemilikan untuk Fase 5.

**`notification_preferences` sengaja ditunda ke Fase 5.** Tidak ada satu pun layar yang bisa mengubahnya sekarang, dan menulis tabel tanpa pengguna adalah kode mati.

### 3.4 Health check

`/health` sekarang hanya `db.sequelize.authenticate()`. Tambahkan tanpa menghubungkan ke layanan eksternal: status job (`SUCCESS`/`FAILED` terakhir dari `job_runs`), dan keberadaan konfigurasi (`SMTP_CONFIGURED`, boolean dari env). Jangan kirim email test di health check.

### Gerbang rilis

- [ ] Login lama tetap jalan (frontend tidak pecah): access token dikirim dengan cara yang sama, cookie `token` masih ada.
- [ ] Refresh menghasilkan pasangan token baru dan meniadakan yang lama; token bekas ditolak dan mencabut seluruh sesi.
- [ ] Dua proses yang menjalankan job yang sama secara bersamaan: satu jalan, satu lewat.
- [ ] SMTP mati → endpoint bisnis tetap sukses; notifikasi menumpuk di `outbox` sebagai `PENDING`.
- [ ] `/health` menampilkan kegagalan job terakhir.

---

## 4. Fase 2 — Rantai approval cuti dua tingkat

**Durasi: 4–6 hari. Butuh Fase 0 (`employee_id` di users) dan Fase 1 (notifikasi + `notify` dengan `transaction`).**

Ini fase kecil yang mengubah modul yang sudah berjalan. Karena itu ia didahulukan dari absensi: skalanya terbatas, risikonya terlokalisir, dan menundanya membuat ia bertabrakan dengan kode absensi yang lebih besar nanti.

### 4.1 Empat hal yang harus berubah

**Pertama, rantai tingkat.** Roadmap §7 sudah memberi desain kolom: `current_level`, `level_1_employee_id`, `level_1_decided_by/at/note`, `level_2_decided_by/at/note`. Implementasinya memakai `employeeContext.requireEmployeeId(req)` dari Fase 0 untuk mengetahui siapa atasan pemanggil.

Penyelesaian atasan saat permohonan dibuat, di `src/modules/leaves/service.js` (file baru):
1. `employee.manager_id` ada, manajernya `status = true` dan `employment_status = 'ACTIVE'` → `LEVEL_1`.
2. Manager kosong, tidak aktif, atau manajernya sendiri yang mengajukan → `LEVEL_2`.
3. Tidak ada satu pun jalur yang membiarkan pemohon menjadi approver dirinya sendiri. Ini ditegakkan di service, bukan di frontend.

**Kedua, penegakan tingkat di `decideLeaveRequest`.** Kondisi sekarang: endpoint hanya memeriksa permission `leave_request.decide` (`src/modules/leaves/index.js:25`), siapa pun yang memegangnya bisa memutuskan permohonan siapa pun. Setelah fase ini:
- `current_level = LEVEL_1` → hanya user yang tertaut ke `level_1_employee_id`. Butuh `leave_request.decide_direct_report` **plus** kecocokan baris.
- `current_level = LEVEL_2` → butuh `leave_request.decide`.
- Tolak dengan 403, bukan hanya sembunyikan tombol. Perbaikan kecil yang sama berlaku untuk `GET /leaves/requests`: atasan hanya melihat baris miliknya (`level_1_employee_id` atau `employee_id` di bawah koordinasinya), bukan seluruh perusahaan. Filter diterapkan di query, bukan di respons.

**Ketiga, `ADMIN` auto-approve di `createLeaveRequest` dihapus.** `src/modules/leaves/controller.js:273-275` menaikkan status langsung ke `APPROVED` bila role pemanggil `ADMIN`. Itu melewati rantai yang baru dibangun dan membuat saldo terpotong tanpa jejak approver. Ubah jadi: `ADMIN` tetap mengajukan lewat rantai dan berakhir di `LEVEL_2`. Kalau butuh jalur darurat, jadikan eksplisit lewat kolom `bypass_reason` yang wajib diisi dan teraudit — bukan diam-diam berdasarkan role.

**Keempat, durasi dihitung server.** `duration_days` berhenti menjadi input klien (`schema.js:36`). Fungsi murni baru di `src/modules/leaves/schema.js`:

```js
countWorkDays(startDate, endDate, shift, holidays)  // → angka hari
```

Di v2 ini cukup menghitung **hari kalender dikurangi hari Sabtu-Minggu sesuai `shifts.work_days`**; tabel `holidays` baru ada di Fase 3, jadi fungsi menerima array libur kosong dan akan diisi ulang di Fase 3. `duration_days` tetap **disimpan** sebagai snapshot di baris permohonan supaya mengedit libur atau shift belakangan tidak mengubah permohonan yang sudah disetujui.

`createLeaveRequestSchema` dan `updateLeaveRequestSchema` tidak lagi mewajibkan `duration_days`. **Ini breaking change kontrak frontend** — umumkan di `docs/leaves-api.md` dan OpenAPI sebelum merge.

### 4.2 Saldo hanya dipotong di tingkat terakhir

Perilaku sekarang tersebar: `createLeaveRequest` bisa memotong saldo (jalur ADMIN) dan `decideLeaveRequest` memotongnya lagi. Kumpulkan ke satu fungsi `applyBalanceOnFinalApproval(leaveRequest, transaction)` yang hanya dipanggil ketika `current_level = LEVEL_2` disetujui. Penolakan di `LEVEL_1` menghentikan permohonan, tidak naik.

Pemohon yang ditolak bisa mengedit lalu mengajukan ulang: `PUT /requests/:id/update` mereset `current_level` ke hasil resolusi atasan dan status ke `PENDING`. Aturan "hanya PENDING yang bisa diubah" (`controller.js:300-302`) tetap berlaku, ditambah satu aturan baru: permohonan yang sudah diputuskan di `LEVEL_1` tidak bisa diubah diam-diam — harus lewat jalur submit ulang.

### 4.3 Migrasi data

Ikuti urutan roadmap §7 dengan dua penyesuaian hasil pembacaan kode:

1. Tambah kolom, semua `PENDING` → `current_level = 'LEVEL_2'`, `level_1_employee_id = NULL`. Pertahankan perilaku sekarang (HR yang memutuskan) sampai rantai aktif.
2. Backfill `level_1_employee_id` dari `employees.manager_id` untuk baris `PENDING`, **hanya bila** manager aktif dan bukan pemohon sendiri. Sisanya tetap `LEVEL_2`.
3. Baris `APPROVED`/`REJECTED` historis dibiarkan; kolom tingkat terisi `NULL` dan dibaca sebagai "diputuskan dengan aturan lama". Jangan tulis ulang sejarah audit.
4. **Baris `APPROVED` yang `approver_id`-nya kosong** — ada, karena `controller.js:279` mengisi `approver_id` dari `employee.manager_id` sebagai fallback. Isi `level_2_decided_by` dari `approver_id` bila cocok, selain itu biarkan `NULL`. Jangan mengarang nama approver.
5. Rantai aktif **langsung** setelah migrasi (roadmap §9.1 poin 11). Gerbangnya satu fungsi di service, bukan sebaran `if` di controller.

### 4.4 Eskalasi dan notifikasi

Job scheduler `leave-escalation` harian: `PENDING` di `LEVEL_1` lebih dari N hari → naik ke `LEVEL_2` + notifikasi ke HR. N dari env (`LEAVE_ESCALATION_DAYS`, default 3). Ini menjawab risiko roadmap §10 "atasan sedang cuti, permohonan menggantung".

Notifikasi dikirim lewat `notify()` Fase 1 **dalam transaksi yang sama** dengan perubahan status. Tiga peristiwa: diajukan (ke atasan), naik tingkat (ke HR), diputuskan (ke pemohon).

### 4.5 Permission dan endpoint baru

Permission: `leave_request.decide_direct_report`. Seeder mengikuti pola idempoten. Role `MANAGER` baru tidak dibuat — permission itu ditambahkan ke role yang sudah ada lewat layar manajemen role, sesuai desain RBAC repo ini.

Endpoint: `PATCH /api/v1/leaves/requests/:id/submit` (ajukan ulang setelah ditolak). `decision` tetap, semantiknya berubah sesuai 4.1.

### Gerbang rilis

- [ ] Atasan bisa menyetujui timnya dan tidak bisa melihat cuti di luar timnya.
- [ ] Karyawan tanpa atasan otomatis jatuh ke HR; tidak ada permohonan yang bisa diputuskan pemohon sendiri.
- [ ] `ADMIN` tidak lagi auto-approve saat membuat permohonan.
- [ ] Saldo hanya berubah pada persetujuan tingkat terakhir; satu permohonan hanya memotong sekali.
- [ ] Permohonan `PENDING` warisan migrasi tetap bisa diputuskan HR tanpa error.
- [ ] `duration_days` tidak lagi diterima dari klien dan hasil hitung cocok dengan test fungsi murni.
- [ ] Test: resolusi atasan (4 kasus), tolak self-approval, penolakan berhenti di LEVEL_1, eskalasi, submit ulang, hitung durasi.

---

## 5. Fase 3 — Absensi, shift, hari libur

**Durasi: 8–12 hari. Butuh Fase 0 dan 1. Ini fase dengan jebakan paling banyak karena menyangkut tanggal.**

Desain tabel, aturan, endpoint, dan permission sudah lengkap di roadmap §3 dan §9.1 poin 10. Bagian ini menambahkan yang hanya diketahui dari kode.

### 5.1 Tanggal bisnis: satu helper, diuji paling awal

Sebelum tabel apa pun dibuat, tulis `src/utils/businessDate.js`:

```js
toBusinessDate(timestamp, shift)   // shift malam 22:00 → 06:00 tetap milik hari mulai
isHoliday(date, holidays)
countWorkDays(start, end, shift, holidays)
```

`countWorkDays` yang sama dipakai modul leave — pindahkan dari `src/modules/leaves/schema.js` ke sini di fase ini, lalu biarkan leave mengimpornya. Satu implementasi hari kerja untuk dua modul; kalau dibiarkan terpisah, cuti dan absensi akan mulai berbeda angka dan tidak ada yang tahu kapan.

Zona waktu `Asia/Jakarta` jadi konstanta config (`APP_TIMEZONE`), dipakai di helper, **bukan** `new Date()` telanjang di controller. Test helper ini adalah test pertama yang ditulis di Fase 3, dan ia harus mencakup: shift normal, shift midnight, check-out lewat tengah malam, libur nasional, cuti bersama, akhir pekan 5-hari dan 6-hari.

### 5.2 Kolom yang perlu diluruskan dari roadmap

Roadmap §3 menulis `attendance_logs.created_by`. Bentuknya harus dua kolom berbeda, karena `audit_logs.user_id` merujuk user sedangkan baris absensi merujuk karyawan:

- `employee_id` — siapa yang absen.
- `recorded_by_user_id` — siapa yang mencatat (pemilik sesi, HR yang mengoreksi, atau `NULL` untuk jalur `HR_CORRECTION` dengan `actor` sistem).

Ini pelajaran dari Fase 0: menyimpan ID karyawan di kolom bernama ambigu adalah cara tautan user/employee rusak lagi.

### 5.3 Integrasi leave → attendance

Saat `applyBalanceOnFinalApproval` (Fase 2) menyetujui tingkat terakhir, tulis hari cakupan ke `attendance_summaries` sebagai `LEAVE`, bukan `ABSENT`. Arah sebaliknya juga: mengoreksi atau membatalkan cuti (`cancelLeaveRequest`, sudah ada di `index.js:26`) harus melepas tanda `LEAVE` itu **bila** periode belum di-close. Bila sudah closed → tolak 409 dan arahkan ke `attendance_adjustments`.

Aturan ini adalah tempat absensi dan payroll bertemu. Kalau dilewatkan, hari cuti akan dihitung sebagai tidak hadir dan memotong gaji — kesalahan yang baru terlihat sebulan kemudian, saat slip gaji sudah dibayar.

### 5.4 Penutupan periode

`POST /api/v1/attendance/summaries/generate` dan `PATCH /summaries/:id/close`. Setelah `CLOSED`, seluruh log hari dalam periode itu read-only: `PATCH /logs/:id/correct` dan `cancelLeaveRequest` menolak dengan 409. Koreksi masuk lewat `attendance_adjustments` yang disetujui, lalu summary dihitung ulang menjadi **periode closed baru** hanya bila ada persetujuan — bukan edit diam-diam.

Job `attendance-day-close` harian: menandai hari tanpa log dan tanpa cuti sebagai `ABSENT`, dan mengisi `holiday_worked_hours` dari log yang jatuh pada hari libur.

### 5.5 Laporan: on-demand, tanpa precompute

Skala di bawah 50 karyawan (roadmap §9.1 poin 9). `GET /reports/late` dan `GET /reports/summary-export` menghitung langsung dari `attendance_logs` dengan agregasi SQL — pola yang sudah dipakai `src/modules/dashboard/controller.js` (ia sudah menulis query agregat untuk leave). Jangan buat tabel ringkasan harian.

Satu-satunya yang disimpan tetap `attendance_summaries` bulanan, karena itu input payroll dan harus dibekukan.

Export memakai `src/utils/excel.js` yang sudah ada. Ia sekarang keras-code kolom employee (`excel.js:16-17`); refactor jadi menerima `{ columns, rows }` — perubahan kecil yang dipakai ulang di payroll dan dokumen.

### Gerbang rilis

- [ ] Shift midnight check-out jam 05:00 tercatat pada tanggal hari mulai, bukan tanggal server.
- [ ] Cuti approved muncul sebagai `LEAVE`; membatalkan cuti setelah periode closed ditolak.
- [ ] Check-in ganda, check-out tanpa check-in, dan check-out ganda ditolak dengan kode yang benar (409/400).
- [ ] Periode `CLOSED` tidak bisa berubah lewat endpoint apa pun.
- [ ] Kerja di hari libur menghasilkan `holiday_worked_hours` terpisah dari `overtime_hours`.
- [ ] Cuti bersama tidak memotong saldo dan tidak menuntut absensi.
- [ ] `businessDate` punya test untuk keenam kasus di 5.1.

---

## 6. Fase 4 — Payroll

**Durasi: 12–18 hari. Fase terpanjang dan paling berisiko. Butuh Fase 3 selesai — `attendance_summaries` yang `CLOSED` adalah inputnya.**

Desain tabel (8 tabel), 11 aturan, endpoint, permission, dan daftar test ada di roadmap §4 dan §9.1 poin 2. Yang berikut adalah cara mengimplementasikannya di repo ini.

### 6.1 Calculator harus fungsi murni

`node --test` di repo ini tidak punya DB (lihat §1). Maka seluruh perhitungan hidup di `src/modules/payroll/calculator.js` dan menerima **snapshot sebagai argumen**, bukan membaca model:

```js
calculatePayrollItem({ structure, components, attendanceSummary, variablePay, holidays })
  → { base, lines: [...], totalEarning, totalDeduction, gross, netPay }
```

Controller hanya merakit argumen dari DB lalu memanggil calculator. Efeknya ganda: perhitungan bisa diuji penuh tanpa Postgres, dan mustahil calculator diam-diam membaca data terbaru — yang merupakan penyebab bug "slip bulan lalu berubah" paling umum.

Ini aturan paling keras di seluruh fase: **calculator tidak boleh menyentuh `db`.**

### 6.2 Urutan pengerjaan dalam fase

1. Migrasi 8 tabel + model + asosiasi. `payroll_items` dan `payroll_item_lines` tanpa `paranoid` dan tanpa endpoint update — jangan sediakan jalurnya sejak awal.
2. `salary_components` master + seeder komponen default (gaji pokok, tunjangan, BPJS sisi karyawan sebagai `VARIABLE`, PPh 21 sebagai `VARIABLE`).
3. `salary_structures` effective-dated + history endpoint. Test tumpang tindih tanggal: dua struktur aktif untuk satu karyawan pada tanggal yang sama harus ditolak.
4. `calculator.js` + test lengkap **sebelum** controller apa pun. Ini titik di mana kesalahan paling murah diperbaiki.
5. `variable_pay` + keputusan approval.
6. `payroll_runs` calculate → submit → approve → pay → void.
7. Snapshot `attendance_summary_snapshot` JSONB dari Fase 3.
8. Export Excel + payslip self-service.
9. OpenAPI + permission seeder + README.

### 6.3 Yang paling sering salah, dan cara menolaknya

- **Pemisahan tugas.** Satu pengguna menghitung, menyetujui, dan menandai lunas. Tegakkan di controller: `approved_by !== created_by` dan `paid_by !== approved_by`. Tolak 403 dengan pesan eksplisit. Ini kontrol audit eksternal pertama yang dicari auditor, dan harganya empat baris.
- **Prorata.** Pembagi = `work_days` dari `attendance_summaries` (sudah dikurangi libur, Fase 3). Bukan hari kalender. Karyawan masuk/keluar di tengah bulan memakai `effective_from`/`effective_to` struktur dan tanggal hire/kontrak.
- **Lembur hari libur.** Dari `holiday_worked_hours` snapshot, tarif dari komponen `PER_HOUR` berbeda. Roadmap §9.2 poin 1 menunda angkanya — jadi komponen itu wajib ada tapi rate-nya diisi HR lewat layar, bukan hardcoded.
- **`variable_pay` dobel serap.** Unique partial index `ON variable_pay (id) WHERE status = 'INCLUDED'` tidak cukup karena satu baris bisa diserap dua run berbeda. Yang benar: `included_run_id` unique partial `WHERE included_run_id IS NOT NULL`, plus set ke `INCLUDED` dalam transaksi yang sama dengan pembuatan baris `payroll_item_lines`.
- **Void menyimpan baris.** `status = 'VOIDED'`, `variable_pay` dikembalikan ke `APPROVED`. Tidak ada `destroy()`.
- **Decimal.** `DECIMAL(14,2)` di DB, dan di JS pakai integer sen atau library desimal — **jangan `Number`** untuk penjumlahan rupiah. Pembulatan hanya di total akhir. Ini penyebab klasik selisih Rp1 antara jumlah baris dan total.
- **Retensi 10 tahun.** Payroll tidak pernah di-purge scheduler (roadmap §9.1 poin 12). Run lama pindah ke mode arsip baca-saja, tidak dihapus.

### 6.4 Payslip self-service dan IDOR

`GET /api/v1/payroll/my-payslips` dan `GET /api/v1/payroll/payslips/:id` memakai `requireEmployeeId(req)` dari Fase 0. Untuk `:id`, cek `payroll_items.employee_id === employeeId` **sebelum** membaca baris. Ini endpoint dengan nilai data tertinggi di seluruh sistem (gaji orang lain) dan merupakan tempat kebocoran horizontal paling sering lahir. Test wajib: minta payslip orang lain → 403/404, bukan 200 dengan data kosong.

### Gerbang rilis

- [ ] Tidak ada endpoint update/delete untuk `payroll_items` atau `payroll_item_lines`.
- [ ] Mengubah struktur gaji bulan depan tidak mengubah slip bulan ini.
- [ ] Run tidak bisa disetujui atau dibayar oleh pembuatnya.
- [ ] Jumlah `payroll_item_lines` persis sama dengan `gross`, `total_deduction`, `net_pay` (test).
- [ ] `variable_pay` yang sama tidak bisa masuk dua run.
- [ ] Void menjaga baris dan mengembalikan `variable_pay`.
- [ ] Payslip orang lain ditolak, dan tesnya ada.
- [ ] Semua test §4 roadmap hijau: satu per `calculation_type`, prorata, midnight, void-regenerate, dobel serap, pemisahan tugas.

---

## 7. Fase 5 — ESS + manajemen dokumen

**Durasi: 8–12 hari. Butuh Fase 4 (payslip memberi ESS isi yang berguna) dan Fase 1 (notifikasi untuk alert kedaluwarsa).**

Desain di roadmap §5 dan §6. Catatan implementasi:

### 7.1 Storage: Cloudflare R2 lewat SDK S3

Dependency: `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`. R2 kompatibel S3, jadi satu klien dengan `endpoint` dan `forcePathStyle` dari env. Bucket **privat**, tanpa public access, tanpa presigned URL.

Upload: `multer` dengan `storage: multer.memoryStorage()` — **bukan** disk. Disk Railway hilang saat redeploy, jadi menulis ke disk lalu memindah ke R2 berarti punya jalur kode yang selalu salah di produksi. Batas ukuran di multer `limits: { fileSize: 10 * 1024 * 1024 }`, jangan mengandalkan `express.json` limit 50mb yang ada di `index.js` (itu memparses body, bukan membatasi multipart).

Validasi MIME dan ukuran: pakai `validationFiles` yang **sudah ada** di `src/utils/validation.js:40-92`. Jangan menulis validator baru.

Download: `GET /documents/:id/download` → cek permission → `GetObjectCommand` → `pipe(res)`. Set `Content-Disposition` dan `Content-Type` dari baris DB, bukan dari objek S3. `exposedHeaders: ['Content-Disposition']` sudah ada di CORS config (`index.js`), jadi frontend sudah bisa membaca nama berkas.

`file_key` menyimpan object key (`documents/{employeeId}/{documentId}/{random}.pdf`), bukan URL. Nama file asli disimpan terpisah di `original_filename` dan tidak pernah dipakai sebagai path.

### 7.2 Kolom identitas: tunda enkripsi aplikasi

Roadmap §6 aturan 3 menyarankan enkripsi `document_number` (NPWP, nomor KTP). Di v1, ganti dengan kontrol yang lebih murah dan tidak merusak query: kolom itu **tidak pernah muncul di respons list**, hanya di detail, dan detail membutuhkan permission khusus. Supabase sudah menyimpan data terenkripsi di level disk. Enkripsi aplikasi ditunda dan dicatat sebagai risiko diterima — kalau nanti diwajibkan, migrasinya terisolasi di satu kolom.

### 7.3 Profil: usulan, bukan edit langsung

`employee_profile_changes` sesuai roadmap §5. Field yang boleh diusulkan karyawan dibatasi daftar eksplisit (`address`, `phone_number`, rekening bank, kontak darurat). Field lain (`department_id`, `position_id`, `employment_status`, `hire_date`) hanya bisa diubah HR lewat `PUT /employees/:id/update` yang sudah ada. Terapkan usulan dengan `createAuditLog` ber-`actorType: 'USER'` dan `oldData`/`newData` penuh.

### 7.4 Retensi

Job `documents-archive` tahunan: karyawan non-ACTIF > 10 tahun → dokumen ditandai `ARCHIVED`. **Tidak ada `DeleteObjectCommand` di kode.** Purge fisik = keputusan manusia dengan nama penanggung jawab (roadmap §9.2 poin 6). Tanggal acuan: `contract_end_date` atau tanggal status non-ACTIF terakhir, bukan `deleted_at`. Bila keduanya kosong → tandai untuk tinjauan manual, jangan bersihkan.

### 7.5 Permintaan yang belum ada: `notification_preferences`

Baru di fase ini ada layar yang mengubahnya. Tabel: `id`, `user_id`, `channel`, `event_type`, `enabled`. Default: semua aktif kecuali kategori berisik (pengingat absensi harian).

### Gerbang rilis

- [ ] Berkas tidak pernah ditulis ke disk; hanya ada di bucket privat.
- [ ] Download menghasilkan `Content-Disposition` benar dan tidak ada URL publik yang tersimpan di log.
- [ ] `document_number` tidak muncul di respons list.
- [ ] Upload `.exe`, `.svg`, dan file > 10 MB ditolak.
- [ ] Karyawan bisa mengubah alamat sendiri dan perubahannya menunggu persetujuan HR.
- [ ] Tidak ada satu baris kode pun yang memanggil `DeleteObjectCommand`.

---

## 8. Fase 6 — Tier 2

Bukan rencana kerja, hanya daftar tunggu. Roadmap §2 Tier 2. Dimulai hanya atas permintaan, dan masing-masing punya risiko sendiri:

- Import karyawan (CSV/XLSX tervalidasi + pratinjau + laporan hasil) — README menyebut ini, tapi bukan blocker HRIS.
- Engine PPh 21 dan BPJS — butuh tarif berbasis tanggal, status PT/TK/PKP, TER bulanan. Beban perawatan tahunan.
- Performance appraisal, rekrutmen/ATS, onboarding-offboarding, pelatihan, org chart, aset, reimbursement.
- Berkas transfer bank untuk disbursement — tiap bank beda format, dan tiap format adalah pekerjaan perawatan sendiri (roadmap §9.2 poin 5).

---

## 9. Ringkasan dependensi antar fase

```
Fase 0  ──┬─→ Fase 2 ──→ Fase 3 ──→ Fase 4 ──→ Fase 5
          │                                  ↗
Fase 1 ───┴─────────────────────────────────
```

- Fase 1 tidak butuh Fase 0 (kecuali `actor_type` untuk job). Keduanya bisa jalan paralel bila ada dua developer.
- Fase 2 tidak bisa dimulai sebelum 0 dan 1.
- Fase 3 butuh 0 dan 1; Fase 2 sebaiknya lebih dulu karena `countWorkDays` dipakai ulang.
- Fase 4 mutlak setelah 3.
- Fase 5 setelah 4.

Total kasar: **40–59 hari kerja** satu developer untuk empat pilar HRIS selesai. Tidak ada jalan pintas yang aman; memangkas Fase 0 atau 1 memindahkan kerusakannya ke Fase 4 dengan biaya lebih tinggi.

---

## 10. Yang sengaja tidak dikerjakan di plan ini

- **Proteksi CSRF.** `sameSite: 'strict'` pada kedua cookie sudah menutup lintas-site request. `csrf.js` dihapus, tidak diperbaiki. Kalau nanti ada login dari subdomain lain, baru dibuka lagi dengan token double-submit.
- **Redis, cache, dan rate-limit terdistribusi.** Di bawah 50 karyawan, memory store cukup. `utils/redis.js` dan `utils/helper.js` dihapus, tidak diimplementasikan.
- **BullMQ / queue pesan.** Kebutuhan fan-out belum ada; transactional outbox + `node-cron` menutup notifikasi dan job.
- **`notification_preferences` sebelum Fase 5.** Tanpa layar pengubah, itu tabel mati.
- **Mode pilot atau feature flag untuk rantai approval.** Sudah diputuskan langsung aktif (roadmap §9.1 poin 11).
- **Precompute ringkasan absensi harian.** Lihat §5.5.
- **Enkripsi aplikasi kolom identitas.** Ditunda dengan alasan di §7.2.
- **Refactor besar-besaran modul yang sudah ada.** Satu-satunya sentuhan ke kode lama: `createAuditLog`, `decideLeaveRequest`/`createLeaveRequest`, `excel.js` (jadi generik), dan pemindahan `countWorkDays`. Selebihnya menambah modul baru mengikuti pola yang sudah benar.

