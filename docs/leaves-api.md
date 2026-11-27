# API Cuti — Panduan Frontend

Dokumen ini menjelaskan kontrak cuti setelah Fase 2: approval dua tingkat, durasi yang dihitung server, pembatasan daftar per tim, dan endpoint ajukan ulang.

Semua endpoint butuh access token. Semua respons memakai envelope `{ success, message, metadata, data }`.

---

## 1. Permission

| Aksi | Permission |
|---|---|
| Lihat tipe cuti | `leave_type.read` |
| Kelola tipe cuti | `leave_type.create`, `leave_type.update`, `leave_type.delete` |
| Lihat permohonan | `leave_request.read` |
| Ajukan permohonan | `leave_request.create` |
| Ubah, ajukan ulang, batalkan | `leave_request.update` |
| Hapus permohonan `PENDING` | `leave_request.delete` |
| Putuskan `LEVEL_1` | `leave_request.decide_direct_report` **dan** cocok dengan `level_1_employee_id` |
| Putuskan `LEVEL_2` | `leave_request.decide` |
| Lihat saldo | `leave_balance.read` |
| Kelola saldo | `leave_balance.create`, `leave_balance.update`, `leave_balance.delete` |

`leave_request.decide_direct_report` tidak diberikan otomatis. Admin harus memberikannya lewat layar manajemen role.

---

## 2. Model status dan tingkat

Status permohonan: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.

Saat `PENDING`, `current_level` menentukan siapa yang harus memutuskan:

| `current_level` | Siapa | Efek setuju | Efek tolak |
|---|---|---|---|
| `LEVEL_1` | Atasan langsung yang tertaut ke `level_1_employee_id` | Naik ke `LEVEL_2`, status tetap `PENDING` | Status menjadi `REJECTED`, selesai |
| `LEVEL_2` | HR (`leave_request.decide`) | Status `APPROVED`, saldo dipotong | Status `REJECTED` |

Aturan yang ditegakkan server:

- Pemohon tidak pernah bisa memutuskan permohonannya sendiri, walaupun punya permission.
- `LEVEL_1` butuh permission **dan** kecocokan baris. Permission saja tidak cukup.
- Baris lama dengan `current_level: null` dibaca sebagai `LEVEL_2`.
- Penolakan di `LEVEL_1` tidak menaikkan permohonan ke HR.
- Saldo hanya berubah pada persetujuan `LEVEL_2`.
- Permohonan `LEVEL_1` yang tidak diputuskan selama `LEAVE_ESCALATION_DAYS` (default 3) naik otomatis ke `LEVEL_2` dan HR mendapat notifikasi.

---

## 3. Durasi dihitung server

`duration_days` **bukan lagi input klien**. FE tidak boleh mengirimnya; bila tetap dikirim, nilainya diabaikan.

Server menghitung:

- Hari Senin sampai Jumat.
- Sabtu dan Minggu dilewati.
- Hari libur nasional **belum** diperhitungkan; tabel libur baru ada di Fase 3.
- Rentang yang tidak mengandung hari kerja ditolak `400`.
- Nilai disimpan sebagai snapshot di baris permohonan. Perubahan aturan di kemudian hari tidak mengubah permohonan lama.

Contoh: `2026-11-27` (Jumat) sampai `2026-11-30` (Senin) menghasilkan `duration_days: 2`.

---

## 4. Ajukan permohonan

`POST /api/v1/leaves/requests/create`

```json
{
  "employee_id": "emp_123",
  "leave_type_id": "lt_123",
  "start_date": "2026-12-01",
  "end_date": "2026-12-03",
  "reason": "Keperluan keluarga"
}
```

Aturan:

- `employee_id` wajib milik user yang login, kecuali pemanggil punya `leave_request.decide` (HR boleh mengajukan untuk karyawan lain).
- `approver_id` tidak perlu dikirim. Bila dikirim, nilainya diabaikan.
- Tanggal tidak boleh overlap dengan permohonan `PENDING` atau `APPROVED` milik karyawan yang sama. Pelanggaran `409`.
- Karyawan harus aktif (`status = true`, `employment_status = ACTIVE`).
- Tipe cuti harus aktif.

Penentuan atasan:

1. `employees.manager_id` ada, aktif, dan bukan pemohon sendiri → `LEVEL_1`, `level_1_employee_id = manager_id`.
2. Selain itu → `LEVEL_2`, `level_1_employee_id = null`.

Respons `201` berisi permohonan lengkap, termasuk `current_level`, `duration_days`, dan `approver_id` (diisi `level_1_employee_id` atau `null`).

Contoh field penting:

```json
{
  "id": "lv_123",
  "employee_id": "emp_123",
  "leave_type_id": "lt_123",
  "approver_id": "emp_456",
  "current_level": "LEVEL_1",
  "level_1_employee_id": "emp_456",
  "level_1_decided_by": null,
  "level_1_decided_at": null,
  "level_1_note": null,
  "level_2_decided_by": null,
  "level_2_decided_at": null,
  "level_2_note": null,
  "escalated_at": null,
  "start_date": "2026-12-01",
  "end_date": "2026-12-03",
  "duration_days": "3.00",
  "reason": "Keperluan keluarga",
  "status": "PENDING",
  "decision_note": null,
  "decided_by": null,
  "decided_at": null
}
```

`duration_days` dikirim sebagai string desimal oleh driver Postgres. Konversi ke angka di FE bila perlu.

---

## 5. Daftar dan detail

### 5.1 Daftar

`GET /api/v1/leaves/requests`

Query yang didukung: `page`, `per_page`, `employee_id`, `leave_type_id`, `approver_id`, `status`, `start_date`, `end_date`.

Batasan visibilitas:

- Pemegang `leave_request.decide` (HR) melihat semua.
- User lain hanya melihat:
  - permohonannya sendiri,
  - permohonan yang dia menjadi `level_1_employee_id`,
  - permohonan karyawan yang `manager_id`-nya dia.
- User tanpa `employee_id` dan tanpa `leave_request.decide` mendapat `403`.

Filter tetap berlaku di atas batasan ini. FE tidak bisa memperluas visibilitas dengan mengirim `employee_id` orang lain.

### 5.2 Detail

`GET /api/v1/leaves/requests/:id/detail`

Aturan visibilitas sama dengan daftar. Permohonan di luar jangkauan menghasilkan `403`.

---

## 6. Ubah permohonan

`PUT /api/v1/leaves/requests/:id/update`

Body yang diterima: `leave_type_id`, `start_date`, `end_date`, `reason`. Semua opsional, minimal satu.

Aturan:

- Hanya `PENDING`.
- Tidak boleh diubah bila sudah disetujui di `LEVEL_1` (`level_1_decided_at` terisi). Server membalas `409`; batalkan atau hapus lalu buat permohonan baru.
- Tanggal baru dihitung ulang oleh server.
- Rantai approval di-resolve ulang. Bila atasan berubah, `level_1_employee_id` dan `current_level` ikut berubah.
- `approver_id` diabaikan.
- Overlap dicek ulang.

FE tidak perlu mengirim `duration_days`.

---

## 7. Putuskan permohonan

`PATCH /api/v1/leaves/requests/:id/decision`

```json
{
  "status": "APPROVED",
  "decision_note": "Disetujui"
}
```

`status` hanya `APPROVED` atau `REJECTED`. `decision_note` opsional dan boleh `null`.

### 7.1 Di `LEVEL_1`

Butuh `leave_request.decide_direct_report` dan `req.user.employee_id === level_1_employee_id`.

Setuju:

- `level_1_decided_by`, `level_1_decided_at`, `level_1_note` terisi.
- `current_level` menjadi `LEVEL_2`.
- `status` tetap `PENDING`.
- Saldo belum berubah.
- HR mendapat notifikasi.

Tolak:

- `level_1_decided_by`, `level_1_decided_at`, `level_1_note` terisi.
- `status` menjadi `REJECTED`.
- `decision_note`, `decided_by`, `decided_at` juga terisi.
- Pemohon mendapat notifikasi.
- Tidak naik ke HR.

### 7.2 Di `LEVEL_2`

Butuh `leave_request.decide`.

Setuju:

- `status` menjadi `APPROVED`.
- `level_2_decided_by`, `level_2_decided_at`, `level_2_note`, `decision_note`, `decided_by`, `decided_at` terisi.
- Saldo dipotong bila `leave_type.requires_balance = true`.
- Cuti berbasis saldo harus dalam satu tahun kalender. Bila tidak, `400`.
- Saldo tidak cukup atau tidak ada → `409`.
- Pemohon mendapat notifikasi.

Tolak:

- `status` menjadi `REJECTED`.
- Saldo tidak berubah.
- Pemohon mendapat notifikasi.

### 7.3 Penolakan yang mungkin

| Kondisi | Status |
|---|---|
| Bukan approver baris itu | `403` |
| Pemohon memutuskan sendiri | `403` |
| Permission tidak cukup | `403` |
| Status bukan `PENDING` | `409` |
| Saldo tidak cukup | `409` |

FE harus tetap menampilkan error dari server; jangan hanya mengandalkan tombol yang disembunyikan.

---

## 8. Ajukan ulang setelah ditolak

`PATCH /api/v1/leaves/requests/:id/submit`

Tidak butuh body.

Aturan:

- Hanya untuk `REJECTED`.
- Hanya pemilik permohonan atau HR (`leave_request.decide`).
- Tanggal dan alasan memakai data yang tersimpan; FE tidak bisa mengubahnya di endpoint ini.
- Rantai approval di-resolve ulang dan durasi dihitung ulang.
- Status kembali `PENDING`.
- `level_1_*`, `level_2_*`, `decision_note`, `decided_by`, `decided_at`, dan `escalated_at` dibersihkan.
- Overlap dicek ulang; bila sudah ada permohonan lain, `409`.

Bila ingin mengubah tanggal atau alasan, buat permohonan baru.

---

## 9. Batalkan dan hapus

### 9.1 Batalkan

`PATCH /api/v1/leaves/requests/:id/cancel`

- Berlaku untuk `PENDING` dan `APPROVED`.
- `APPROVED` yang memakai saldo akan mengembalikan `used_days`.
- Status menjadi `CANCELLED`.
- `decided_by` dan `decided_at` diisi user yang membatalkan.
- Saldo tidak konsisten → `409`, pembatalan tidak diterapkan.

### 9.2 Hapus

`DELETE /api/v1/leaves/requests/:id/delete`

- Hanya `PENDING`.
- Menghapus baris, bukan mengubah status.

---

## 10. Kalender

`GET /api/v1/leaves/calendar?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

Mengembalikan permohonan `PENDING` dan `APPROVED` yang beririsan dengan rentang. Filter opsional: `employee_id`, `leave_type_id`, `status`.

Catatan: kalender **belum** dibatasi per tim. Jangan menganggap isinya sama dengan hasil `GET /leaves/requests`.

---

## 11. Saldo

Endpoint saldo tidak berubah:

- `GET /api/v1/leaves/balances`
- `GET /api/v1/leaves/balances/:id/detail`
- `POST /api/v1/leaves/balances/create`
- `PUT /api/v1/leaves/balances/:id/update`
- `DELETE /api/v1/leaves/balances/:id/delete`

Yang berubah hanya waktu pemotongan: sekarang terjadi di persetujuan `LEVEL_2`, bukan saat pembuatan atau persetujuan `LEVEL_1`.

FE sebaiknya menampilkan saldo sebagai informasi, bukan dasar perhitungan di klien. Server tetap memvalidasi saat persetujuan final.

---

## 12. Checklist FE layar cuti

- [ ] Form pengajuan tidak mengirim `duration_days` dan tidak mengirim `approver_id`.
- [ ] Durasi ditampilkan dari respons server, bukan dihitung di klien.
- [ ] Daftar dan detail menangani `403` untuk data di luar tim.
- [ ] Tombol putuskan mempertimbangkan `current_level` dan permission user.
- [ ] `LEVEL_1` yang disetujui tetap berstatus `PENDING`; jangan menampilkan sebagai selesai.
- [ ] `LEVEL_1` yang ditolak berstatus `REJECTED`; jangan menunggu HR.
- [ ] Aksi ajukan ulang hanya muncul untuk `REJECTED`.
- [ ] Aksi ubah tidak muncul bila `level_1_decided_at` terisi.
- [ ] Pembatalan `APPROVED` menjelaskan bahwa saldo dikembalikan.
- [ ] Setelah aksi, muat ulang detail untuk mengambil field keputusan terbaru.
- [ ] Notifikasi `LEAVE_APPROVAL_NEEDED` diarahkan ke layar approval yang sesuai.
