# Panduan Integrasi Frontend — Fase 0 sampai Fase 2

Dokumen ini merangkum **semua perubahan backend yang terlihat oleh frontend** setelah Fase 0, 1, dan 2. Baca bagian yang relevan sebelum mengerjakan layar terkait.

Kontrak lengkap tetap ada di `GET /api-docs/openapi.json`. Dokumen ini menjelaskan hal yang tidak terlihat dari OpenAPI: alur, urutan panggilan, dan hal yang bisa mematahkan integrasi lama.

---

## 1. Ringkasan perubahan

| Fase | Perubahan | Dampak FE |
|---|---|---|
| 0 | `users.employee_id` | Login dan `get-me` mengembalikan `employee_id`. Akun bisa ditautkan ke karyawan. |
| 0 | `audit_logs.actor_type`, `actor_label`, `user_id` nullable | Baris audit bisa milik sistem (`user_id: null`). FE wajib memakai `actor_type`/`actor_label`. |
| 0 | `createAuditLog` menolak aktor kosong | Tidak ada perubahan kontrak; audit tidak lagi mencatat user acak. |
| 1 | Access token 15 menit + refresh token berotasi | FE harus menangani `401` dengan satu kali `POST /auth/refresh`, lalu retry. |
| 1 | Sesi server-side | Logout mencabut sesi. Ada endpoint daftar dan cabut sesi. |
| 1 | Notifikasi in-app | Endpoint daftar, tandai satu, tandai semua. |
| 2 | Approval cuti dua tingkat | Lihat `docs/leaves-api.md`. |
| 2 | `duration_days` dihitung server | FE tidak boleh mengirim `duration_days`. |
| 2 | Daftar/detail cuti dibatasi per tim | Non-HR hanya melihat cuti sendiri dan tim langsung. |
| 2 | Set permission role `EMPLOYEE` dibatasi | Karyawan biasa kehilangan akses ke halaman Employees (`employee.read` dihapus) dan tidak bisa lagi memutuskan cuti (`leave_request.decide` dihapus). |
| 2 | `PUT /roles/:id/permissions` bersifat full replace | Layar Roles harus mengirim **seluruh** set yang diinginkan, bukan hanya yang baru dipilih. Lihat §6.2. |

---

## 2. Auth dan sesi

### 2.1 Cookie dan token

Login menetapkan dua cookie `HttpOnly`:

| Cookie | Path | Umur | Isi |
|---|---|---|---|
| `token` | `/` | 15 menit | access token |
| `refresh_token` | `/api/v1/auth` | 30 hari | refresh token, berotasi setiap dipakai |

Keduanya `SameSite=Strict` dan `Secure` saat `NODE_ENV=production`.

**FE wajib:**

- Kirim request dengan kredensial cookie: `fetch(url, { credentials: 'include' })` atau `axios` dengan `withCredentials: true`.
- Jangan menyimpan access token di `localStorage`. Cookie sudah `HttpOnly`.
- Jika FE memakai header `Authorization: Bearer <token>`, ambil token dari `data.token` pada respons login dan refresh.
- **FE saat ini memakai proxy Next.js** (`app/api/backend/[...path]/route.ts`), bukan panggilan lintas domain. Proxy meneruskan header `cookie` dan `authorization`, lalu **menulis ulang setiap `Set-Cookie` dari BE**: atribut `Domain` dibuang, `Path` dipaksa `/`, dan `SameSite` dipaksa `Lax`. Konsekuensinya:
  - Hanya cookie yang diterima browser dari origin FE. Karena proxy bersifat same-origin, `SameSite=Strict` milik BE tidak pernah sampai ke browser.
  - `refresh_token` yang di BE ber-`Path=/api/v1/auth` menjadi `Path=/` di browser, jadi ikut terkirim pada semua request FE.
  - Bila FE nanti memanggil BE langsung (tanpa proxy), syarat "satu registrable domain" berlaku kembali dan `SameSite=Strict` akan memblokir request lintas situs total.
  - Proxy harus tetap ada selama cookie ditulis ulang di sana. Menghapus proxy tanpa memindahkan penulisan cookie akan memutus sesi.

### 2.2 Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| POST | `/api/v1/auth/login` | publik | Body `{ email, password }` |
| POST | `/api/v1/auth/refresh` | cookie refresh | Tidak butuh body |
| POST | `/api/v1/auth/logout` | cookie | Mencabut sesi aktif dan menghapus cookie |
| GET | `/api/v1/auth/get-me` | access token | Profil + permission |
| GET | `/api/v1/auth/sessions` | access token | Sesi aktif milik user |
| DELETE | `/api/v1/auth/sessions/:id/revoke` | access token | Cabut satu sesi |

### 2.3 Bentuk respons login dan refresh

```json
{
  "success": true,
  "message": "success",
  "metadata": {},
  "data": {
    "id": "usr_123",
    "email": "budi@example.com",
    "employee_id": "emp_123",
    "role": "EMPLOYEE",
    "permissions": ["leave_request.read", "leave_request.create"],
    "token": "eyJhbGciOi..."
  }
}
```

`refresh` mengembalikan bentuk yang sama, termasuk `token` baru. `get-me` mengembalikan bentuk yang sama tanpa `token`.

`employee_id` bisa `null`. Artinya akun belum ditautkan ke data karyawan. FE harus menampilkan keadaan "akun belum terhubung ke karyawan" dan menyembunyikan fitur yang butuh identitas karyawan (pengajuan cuti mandiri, absensi mandiri, slip gaji). Jangan menganggap `null` berarti karyawan tidak punya data.

### 2.4 Alur refresh yang benar

Access token berumur 15 menit. Saat request terlindungi mengembalikan `401`:

1. Panggil `POST /api/v1/auth/refresh` **satu kali**.
2. Jika sukses, ulangi request awal **satu kali**.
3. Jika refresh gagal, arahkan ke halaman login.

**Aturan penting:** refresh token berotasi. Token lama langsung dicabut setelah dipakai. Jika dua request refresh berjalan bersamaan dengan token yang sama, request kedua dianggap **replay** dan server mencabut **semua sesi user**. FE wajib memakai mekanisme *single-flight*: satu promise refresh dipakai bersama oleh semua request yang menunggu.

Refresh hanya membaca cookie `refresh_token`; endpoint ini tidak menerima token di body atau header `Authorization`.

Contoh pola:

```js
let refreshPromise = null

async function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    }).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}
```

Jangan melakukan retry berulang. Jangan memanggil refresh secara paralel dari beberapa komponen.

### 2.5 Logout

Logout bukan lagi sekadar menghapus token di klien. FE harus memanggil `POST /api/v1/auth/logout` agar sesi dicabut di server, lalu membersihkan state lokal.

Sesi yang dicabut berhenti bisa diperpanjang seketika. Access token yang sudah terbit tetap valid sampai kedaluwarsa, maksimal 15 menit.

### 2.6 Daftar sesi

`GET /api/v1/auth/sessions` mengembalikan array (tanpa paginasi):

```json
[
  {
    "id": "ses_123",
    "current": true,
    "user_agent": "Mozilla/5.0 ...",
    "ip_address": "10.0.0.1",
    "last_used_at": "2026-11-27T09:00:00.000Z",
    "expires_at": "2026-12-27T09:00:00.000Z",
    "created_at": "2026-11-27T09:00:00.000Z"
  }
]
```

`current: true` menandai sesi yang dipakai request ini. Tombol "cabut" memanggil `DELETE /api/v1/auth/sessions/:id/revoke`. Menolak sesi yang sudah tidak ada menghasilkan `404`.

---

## 3. Notifikasi

Semua endpoint butuh access token.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/v1/notifications` | Daftar notifikasi user |
| PATCH | `/api/v1/notifications/:id/read` | Tandai satu sudah dibaca |
| PATCH | `/api/v1/notifications/read-all` | Tandai semua sudah dibaca |

Query daftar:

- `page` (default 1)
- `per_page` (default 10, maksimal 100)
- `unread=true` untuk hanya yang belum dibaca

Respons daftar memakai envelope paginasi standar. `data` berisi array notifikasi, `metadata` berisi `per_page`, `current_page`, `total_row`, `total_page`.

Field notifikasi yang dipakai FE:

```json
{
  "id": "ntf_123",
  "type": "LEAVE_APPROVAL_NEEDED",
  "title": "Leave request awaiting approval",
  "body": "Budi requested 2 working day(s) of Annual Leave.",
  "entity_type": "LeaveRequest",
  "entity_id": "lv_123",
  "read_at": null,
  "created_at": "2026-11-27T09:00:00.000Z"
}
```

Tipe yang sudah dipakai saat ini: `LEAVE_APPROVAL_NEEDED`, `LEAVE_DECISION`. Jangan mengandalkan daftar ini sebagai satu-satunya nilai; tampilkan `title` dan `body` apa adanya, dan gunakan `type` hanya untuk ikon atau pengelompokan.

Gunakan `entity_type` + `entity_id` untuk membuka detail terkait. Jangan menebak route dari `type`.

Notifikasi email dikirim lewat job terpisah. Bila SMTP belum dikonfigurasi, notifikasi in-app tetap muncul; email tetap `PENDING` dan dicoba ulang. FE tidak perlu menangani hal ini.

---

## 4. User dan tautan ke karyawan

### 4.1 Daftar dan detail user

`GET /api/v1/users` sekarang mengembalikan `employee_id` per baris:

```json
{
  "id": "usr_123",
  "email": "budi@example.com",
  "employee_id": "emp_123",
  "role": "EMPLOYEE",
  "status": true,
  "created_at": "...",
  "updated_at": "..."
}
```

`GET /api/v1/users/:id/detail` juga mengembalikan `employee_id`.

### 4.2 Membuat dan mengubah user

`POST /api/v1/users/create`:

```json
{
  "email": "budi@example.com",
  "password": "rahasia123",
  "role_id": "rol_123",
  "employee_id": "emp_123",
  "status": true
}
```

`PUT /api/v1/users/:id/update` menerima field yang sama, semuanya opsional. Kirim `"employee_id": null` untuk melepas tautan.

Aturan:

- `employee_id` harus menunjuk karyawan yang ada dan `status = true`. Jika tidak, `400`.
- Satu karyawan hanya boleh tertaut ke satu user aktif. Pelanggaran menghasilkan `409`.
- `role_id` diambil dari `GET /api/v1/users/get-all-roles`.
- Nama field kontrak adalah `role_id`, bukan `role`.

FE sebaiknya menampilkan pemilih karyawan pada form user, plus indikator "belum tertaut" untuk user dengan `employee_id: null`.

---

## 5. Audit log

`GET /api/v1/audit-logs` sekarang mengembalikan aktor secara eksplisit:

```json
{
  "id": "aud_123",
  "user_id": null,
  "user_email": null,
  "actor_type": "SYSTEM",
  "actor_label": "auth:refresh-replay",
  "action": "UPDATE",
  "entity": "LeaveRequest",
  "entity_id": "lv_123",
  "old_data": {},
  "new_data": {},
  "created_at": "2026-11-27T09:00:00.000Z"
}
```

Aturan tampilan:

- `actor_type: "USER"` → tampilkan `user_email` (atau `user_id` bila email kosong).
- `actor_type: "SYSTEM"` → tampilkan `actor_label`; `user_id` dan `user_email` bernilai `null`.
- Jangan menganggap `user_id` selalu ada.

Pencarian `q` mencakup `entity`, `entity_id`, `actor_label`, dan `user_email`. Export CSV sekarang memiliki kolom **Actor Type** dan **Actor Label**.

Hal yang sama berlaku untuk `recent_activity` di `GET /api/v1/dashboard`. Setiap baris sekarang membawa `actor_type` dan `actor_label` di samping `user_email`, jadi baris sistem tidak lagi tampil tanpa nama. Pakai aturan tampilan yang sama seperti audit log.


---

## 6. Permission baru

Permission baru: `leave_request.decide_direct_report`.

Fungsinya mengizinkan user memutuskan cuti **tim langsungnya** di `LEVEL_1`, dan tetap harus cocok dengan baris `level_1_employee_id`. Permission ini tidak diberikan otomatis oleh seeder. Admin harus memberikannya lewat layar manajemen role kepada role yang dipakai para atasan.

Tanpa permission ini, atasan menerima `403` saat menyetujui, dan permohonan akan naik ke HR setelah `LEAVE_ESCALATION_DAYS` (default 3 hari).

FE sebaiknya:

- Menampilkan tombol setujui/tolak hanya bila user punya `leave_request.decide` atau `leave_request.decide_direct_report`, **dan** baris tersebut memang ada di tingkat yang bisa dia putuskan.
- Tetap menangani `403` dari server sebagai keputusan final.
- Sadari bahwa `leave_request.decide` dipakai BE untuk dua hal: hak memutuskan **dan** hak mengajukan cuti untuk orang lain. Jangan memberikan key ini ke role karyawan biasa hanya untuk memberi akses mengajukan; gunakan `leave_request.create`.

### 6.1 Set permission yang diharapkan per role

Server tidak memeriksa nama role, hanya key permission. Karena itu set per role adalah satu-satunya pengaman. Kondisi yang diharapkan setelah Fase 2:

| Role | Key yang diharapkan | Catatan |
|---|---|---|
| `ADMIN` | Semua key, termasuk `leave_request.decide` | ADMIN ikut rantai approval, tidak bypass. |
| `HR` | Semua key kecuali `role.delete`, `user.delete`, `employee.delete`, `department.delete`, **plus** `leave_request.decide_direct_report` | Key terakhir hanya diberikan manual lewat layar Roles. |
| `EMPLOYEE` | `dashboard.read`, `leave_request.read`, `leave_request.create`, `leave_request.update`, `leave_type.read`, `leave_balance.read` | Tepat enam key. |

`EMPLOYEE` **tidak boleh** memiliki:

- `employee.read` atau `employee.export` — `GET /api/v1/employees` mengembalikan `phone_number`, `address`, `contract_start_date`, `contract_end_date`, `hire_date`, dan `employment_status` seluruh karyawan tanpa pembatasan baris. Ini data pribadi, bukan direktori. Karyawan biasa tidak punya layar yang membutuhkannya.
- `leave_request.decide` atau `leave_request.decide_direct_report` — `authorizeDecision` untuk `LEVEL_2` hanya memeriksa `leave_request.decide`. Tanpa guard lain, karyawan biasa yang memegang key itu bisa menyetujui permohonan cuti siapa pun.
- `leave_request.delete`, `leave_type.create/update/delete`, `leave_balance.create/update/delete`.
- Semua key `user.*`, `role.*`, `audit_log.*`.

Pengajuan cuti sendiri **tidak** membutuhkan `employee.read`. FE memakai `employee_id` dari `/auth/get-me`. Sidebar **Employees** digerbangi `employee.read`, jadi item itu hilang sendiri untuk karyawan biasa — itu perilaku yang diinginkan, bukan bug.

Bila set ini rusak lagi (misalnya oleh seeding ulang dengan seeder lama), perbaiki dengan:

```bash
npm run repair:roles               # dry-run, hanya mencetak rencana
npm run repair:roles -- --apply    # tulis
```

Skripnya idempoten dan hanya menyentuh role `EMPLOYEE`.

### 6.2 `PUT /roles/:id/permissions` adalah full replace

`src/modules/role/controller.js` menghapus **seluruh** baris `role_permissions` milik role itu (`destroy({ where: { role_id } })`) lalu menulis ulang isi `permission_ids`. Endpoint ini bukan append dan bukan delta.

Konsekuensi untuk layar Roles:

- Kirim daftar lengkap permission yang seharusnya dimiliki role itu, termasuk yang tidak diubah.
- Mengirim daftar kosong menghapus semua permission role tersebut.
- Kesalahan ini tidak terlihat di UI: role yang kehilangan `dashboard.read` tetap bisa login, tapi langsung kehilangan akses lain secara diam-diam.

Inilah yang terjadi pada role `EMPLOYEE`: dialog Manage permissions tersimpan dengan hanya 13 key cuti, sehingga `dashboard.read` hilang dan `leave_request.decide` justru masuk.

---

## 7. Envelope respons dan error

Semua respons memakai bentuk:

```json
{
  "success": true,
  "message": "success",
  "metadata": {},
  "data": {}
}
```

Error memakai bentuk yang sama dengan `success: false`, `data: null`, dan `message` berisi alasan. `metadata` berisi paginasi untuk endpoint daftar.

Status yang perlu ditangani FE:

| Status | Arti |
|---|---|
| `400` | Validasi payload atau aturan bisnis |
| `401` | Access token tidak ada/kedaluwarsa, atau refresh token tidak valid |
| `403` | Permission kurang, user/role nonaktif, bukan approver baris itu, atau bukan pemilik data |
| `404` | Data tidak ditemukan |
| `409` | Konflik status, saldo tidak cukup, tanggal overlap, atau tautan duplikat |

Jangan menampilkan `message` mentah sebagai teks utama bila bahasanya tidak sesuai; gunakan sebagai detail teknis.

### 7.1 Health

`GET /health` (tanpa prefix `/api/v1`, tanpa auth) sekarang mengembalikan:

```json
{
  "success": true,
  "message": "success",
  "metadata": {},
  "data": {
    "status": "ok",
    "database": "connected",
    "mail_configured": false,
    "outbox_pending": 3,
    "jobs": {
      "notification-outbox-drain": { "status": "SUCCESS", "started_at": "...", "finished_at": "...", "error": null }
    },
    "timestamp": "2026-11-27T09:00:00.000Z"
  }
}
```

Bila database tidak dapat dihubungi, endpoint membalas `503`. FE boleh memakai `mail_configured` dan `outbox_pending` untuk indikator operasional, tetapi jangan memblokir layar pengguna karena job atau email belum berjalan.

---

## 8. Checklist FE per layar

### Login dan sesi

- [ ] Request auth memakai `credentials: 'include'`.
- [ ] Access token 15 menit ditangani dengan refresh single-flight.
- [ ] Retry setelah refresh maksimal satu kali, tanpa loop.
- [ ] Logout memanggil endpoint server.
- [ ] Halaman sesi memakai `GET /auth/sessions` dan `DELETE /auth/sessions/:id/revoke`.

### Shell aplikasi

- [ ] `get-me` menyimpan `employee_id` dan `permissions`.
- [ ] Bila `employee_id: null`, tampilkan keadaan "belum tertaut" dan sembunyikan fitur ESS.
- [ ] Guard menu memakai `permissions`, bukan hanya `role`.
- [ ] `403` tetap ditangani sebagai penolakan final.

### Notifikasi

- [ ] Badge unread memakai `unread=true` atau menghitung `read_at`.
- [ ] Tandai satu dan tandai semua memakai endpoint yang tersedia.
- [ ] Klik notifikasi memakai `entity_type` + `entity_id`.

### Manajemen user

- [ ] Form create/update mengirim `role_id`, bukan `role`.
- [ ] Form menyediakan pilih karyawan dan bisa mengosongkan tautan (`null`).
- [ ] Menangani `409` saat karyawan sudah tertaut ke user lain.
- [ ] Daftar user menampilkan status tertaut/belum tertaut.

### Audit log

- [ ] Kolom aktor memakai `actor_type` + `actor_label` / `user_email`.
- [ ] Baris sistem tidak menampilkan user kosong sebagai error.
- [ ] Export CSV memakai kolom baru.

### Cuti

- [ ] Ikuti `docs/leaves-api.md`.
- [ ] Gerbang "ajukan untuk karyawan lain" mengikuti BE: hanya `leave_request.decide`. `employee.read` hanya menentukan pemilih karyawan bisa dimuat.
- [ ] Query yang bisa dinonaktifkan (`enabled: false`) tidak boleh memakai `isPending` sebagai syarat disabled; pakai `isLoading` atau `isFetching`.

### Roles

- [ ] Dialog manage permission mengirim set lengkap role, bukan hanya pilihan baru (lihat §6.2).
- [ ] Set `EMPLOYEE` sesuai daftar di §6.1; tidak ada `employee.read` maupun key `decide`.
- [ ] Sidebar menyembunyikan **Employees** untuk karyawan biasa tanpa menampilkan error.

---

## 9. Yang belum boleh diasumsikan FE

- Kalender cuti (`GET /leaves/calendar`) masih menampilkan data lintas perusahaan; pembatasan per tim baru berlaku di daftar dan detail permohonan.
- Daftar saldo cuti belum dibatasi per tim.
- Belum ada endpoint untuk mengubah `users.employee_id` secara massal; gunakan create/update user atau script backfill.
- Belum ada endpoint cuti untuk lampiran dokumen.
- Belum ada perhitungan hari libur nasional. Durasi cuti saat ini hanya mengecualikan Sabtu dan Minggu.

Jika salah satu dari hal di atas dibutuhkan untuk sebuah layar, jangan menebak kontraknya; tambahkan sebagai pekerjaan backend lebih dulu.
