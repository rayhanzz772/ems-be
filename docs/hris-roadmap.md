# Roadmap: dari EMS menjadi HRIS

Dokumen ini menilai kondisi `ems-be` hari ini dan menyusun roadmap fitur supaya aplikasi layak disebut HRIS.

Status: **rencana, belum diimplementasikan.** Ditulis 27 November 2026 berdasarkan pembacaan kode di commit `77e7ab7`.

Empat belas keputusan sudah ditetapkan dan tercermin di seluruh dokumen (daftar lengkap di §9.1): internal satu perusahaan, payroll komponen manual, absensi web, approval cuti dua tingkat, satu zona waktu dan satu mata uang, file di Cloudflare R2, prorata hari kerja efektif, retensi 10 tahun, tabel `holidays` terpisah, rantai approval langsung aktif, mulai dari Fase 1, skala di bawah 50 karyawan. Tidak ada lagi keputusan arsitektur yang menggantung.

---

## 1. Kondisi saat ini

Yang sudah ada dan berfungsi:

| Area | Isi |
|---|---|
| Auth | Login, logout, `get-me`, JWT cookie HttpOnly, argon2/bcrypt |
| RBAC | Permission granular `resource.action`, role ADMIN/HR/EMPLOYEE, manajemen role + assign permission |
| Master data | Department, Branch, Position (CRUD + toggle status) |
| Employee | CRUD, soft delete (`paranoid`), relasi department/position/branch/manager, CSV export, kontrak (`tipe PERMANENT/CONTRACT/INTERN`, `contract_start_date`, `contract_end_date`) |
| Leave | Tipe cuti, permohonan, keputusan/approve, cancel, saldo, kalender |
| Audit | Audit log create/update/delete + export |
| Dashboard | Agregat employee, department, leave |
| Kualitas | 4 test (`rbac`, `employee-schema`, `branch-schema`, `leaves-schema`), OpenAPI di `/api-docs/openapi.json`, pino logger |

Kesimpulan: ini **EMS (Employee Management System)**, yaitu core HR separuh. Yang belum ada adalah tiga pilar yang membuat sesuatu disebut HRIS: **absensi/kehadiran**, **penggajian**, dan **layanan mandiri karyawan (ESS) beserta dokumen**. Tanpa itu, "HRIS" hanya klaim nama.

Data yang sudah tersedia tapi belum dipakai: `contract_end_date` (tidak ada alert kedaluwarsa), `hire_date` (tidak ada perhitungan masa kerja/prorata), relasi `manager_id` (tidak dipakai untuk rantai approval cuti).

---

## 2. Yang hilang, dikelompokkan

### Tier 0 — Fondasi (mem-block semua fitur di bawah)

| Fitur | Kenapa wajib |
|---|---|
| Scheduler / worker | Kontrak kedaluwarsa tanpa alert, saldo cuti tanpa reset tahunan, absensi tanpa penutupan hari, gaji tanpa penutupan bulan. Belum ada dependensi cron sama sekali. |
| Notifikasi (in-app + email) | Keputusan cuti, slip gaji siap, dokumen kedaluwarsa, perubahan profil menunggu verifikasi. Belum ada dependensi mail. Sudah ada di daftar "Next Features" README sendiri. |
| Refresh token + revocation sesi | Data yang diproteksi: gaji, NPWP, KTP. Akses berbasis cookie tunggal tanpa renew belum jadi baseline keamanan yang layak. Juga tercatat unchecked di README. |
| ~~`get-me` mengembalikan list permission~~ | **Sudah selesai di kode** (`src/modules/auth/controller.js:99-124`). README §4 yang basi. Lihat `hris-phase-implementation-plan.md` §0. |
| Tautan `users.employee_id` | Belum ada. Tanpa ini rantai approval, absensi mandiri, slip gaji mandiri, dan seluruh ESS tidak bisa menegakkan "user ini karyawan yang mana". Blocker untuk Fase 2–5. |

Pilihan scheduler: `node-cron` cukup selama backend jalan satu instance (Railway saat ini). Begitu scale lebih dari satu instance, cron berjalan duplikat — pindah ke BullMQ + Redis. Jangan bangun abstraksi queue sekarang; tulis sebagai catatan upgrade.

### Tier 1 — Modul yang membuat layak disebut HRIS

1. Absensi & Shift
2. Penggajian (Payroll)
3. Employee Self-Service (ESS)
4. Manajemen dokumen karyawan

### Tier 2 — Diferensiator (tidak wajib untuk klaim "layak HRIS")

Performance appraisal/KPI, rekrutmen (ATS), onboarding/offboarding workflow, pelatihan & sertifikasi, org chart visual, laporan/BI, engine PPh 21 & BPJS internal, manajemen aset, biaya karyawan (reimbursement).

---

## 3. Desain Absensi & Shift

### Tabel

**`shifts`** — `id`, `name`, `code`, `branch_id` (nullable, null = berlaku semua), `start_time`, `end_time`, `grace_minutes`, `crosses_midnight` (boolean), `work_days` (array hari, untuk shift mingguan), `status`, timestamps.

**`employee_shifts`** — `id`, `employee_id`, `shift_id`, `effective_from`, `effective_to` (nullable). Effective-dated: riwayat shift harus terjaga karena absensi bulan lalu dihitung dengan shift bulan itu, bukan shift hari ini.

**`holidays`** — `id`, `date` unique, `name`, `type` (`NASIONAL`/`CUTI_BERSAMA`/`KEAGAMAAN`/`LOKAL_PER_CABANG`), `branch_id` (nullable, null = berlaku semua cabang), `status`, timestamps.

Tabel ini terpisah dari `shifts.work_days` karena keputusan pemerintah berubah tiap tahun dan sering diumumkan mendadak. Menanam libur di kode atau mengedit shift untuk mengakomodasinya membuat satu kesalahan ketik mengubah angka gaji seluruh perusahaan.

Aturan `holidays`:
1. Hari libur **bukan** hari kerja. Ia mengurangi pembagi prorata dan menghapus tuntutan absensi hari itu.
2. Karyawan yang tetap masuk pada hari libur dihitung **lembur dengan tarif libur**, bukan lembur biasa. Tarifnya komponen `EARNING` dengan `calculation_type = PER_HOUR` dan rate terpisah; jangan menyamakan dengan lembur harian.
3. `CUTI_BERSAMA` tidak mengurangi saldo cuti. Ini harus ditegaskan di controller, karena perilaku default modul leave adalah memotong saldo untuk setiap hari yang dicakup permohonan.
4. `type = LOKAL_PER_CABANG` dengan `branch_id` terisi hanya berlaku untuk cabang itu. Cabang lain tetap menghitungnya sebagai hari kerja.

**`attendance_logs`** — `id`, `employee_id`, `attendance_date`, `check_in_at`, `check_out_at`, `check_in_note`, `check_out_note`, `source` (`WEB`/`API`/`HR_CORRECTION`), `latitude`, `longitude`, `device_info`, `created_by`, timestamps. Unique aktif: (`employee_id`, `attendance_date`).

`latitude`, `longitude`, dan `device_info` tetap dibuat tapi dibiarkan `NULL` di v1 karena absensi hanya lewat web. Kolom itu ada supaya tidak perlu migrasi saat kiosk atau mobile dibangun nanti — biayanya tiga kolom, penghematannya satu migrasi.

**`attendance_adjustments`** — `id`, `employee_id`, `attendance_date`, `type` (`MISSING_PUNCH`/`LATE_CLEAR`/`EARLY_LEAVE_CLEAR`/`OVERTIME`/`WORK_FROM_ANYWHERE`), `requested_from`/`requested_to` (untuk overtime), `reason`, `status` (`PENDING`/`APPROVED`/`REJECTED`), `requested_by`, `decided_by`, `decided_at`, `decision_note`.

**`attendance_summaries`** — `id`, `employee_id`, `period` (`YYYY-MM`), `work_days`, `present_days`, `late_count`, `late_minutes`, `early_leave_count`, `absent_days`, `leave_days`, `outside_days`, `overtime_hours`, `holiday_worked_hours`, `status` (`OPEN`/`CLOSED`), `closed_at`, `closed_by`.

`work_days` sudah dikurangi hari libur dari `holidays`. `holiday_worked_hours` disimpan terpisah dari `overtime_hours` karena tarifnya berbeda, dan payroll membutuhkan keduanya sebagai baris berbeda.

### Yang dihitung, bukan disimpan

`late_minutes`, `early_leave_minutes`, `overtime_hours`, dan status harian diturunkan dari (`attendance_logs` + `employee_shifts` + `leave_requests` + `attendance_adjustments` yang approved). Nilai ini dibekukan hanya saat summary di-close, sebagai snapshot untuk payroll.

### Aturan yang harus ditegakkan di controller

1. **Batas hari pakai tanggal shift, bukan tanggal server.** Shift malam 22:00–06:00 yang check-out jam 05:00 tetap milik `attendance_date` hari sebelumnya. Ini jebakan paling umum dan paling mahal kalau salah. Sudah diputuskan: tanggal absensi mengikuti tanggal mulai shift. Zona waktu `Asia/Jakarta` berlaku untuk semua cabang dan disimpan sebagai konstanta config, bukan kolom per cabang.
2. Check-out tanpa check-in → tolak (400). Check-in ganda → tolak (409). Check-out ganda → tolak (409).
3. Cuti yang sudah approved pada **keputusan tingkat terakhir** (§7 desain Fase 2) mengisi hari itu sebagai `LEAVE`, bukan `ABSENT`. Integrasi dengan modul leave yang sudah ada: saat keputusan final disetujui, hari cakupannya otomatis ditandai.
4. Setelah `attendance_summaries.status = CLOSED`, log hari dalam periode itu read-only. Koreksi tidak boleh mengedit log; koreksi masuk lewat `attendance_adjustments` yang disetujui dan diaudit. Ini menjaga integritas angka yang sudah dipakai payroll.
5. Semua tulis/perubahan absensi dan keputusan adjustment dicatat ke audit log yang sudah ada.

### Endpoint

```
GET    /api/v1/attendance/logs                      attendance.read
GET    /api/v1/attendance/logs/:id/detail           attendance.read
POST   /api/v1/attendance/check-in                  attendance.record_self
POST   /api/v1/attendance/check-out                 attendance.record_self
GET    /api/v1/attendance/my                        attendance.read_self
PATCH  /api/v1/attendance/logs/:id/correct          attendance.update   (HR)
POST   /api/v1/attendance/adjustments               attendance.adjust.request
GET    /api/v1/attendance/adjustments               attendance.read
PATCH  /api/v1/attendance/adjustments/:id/decision  attendance.adjust.decide
GET    /api/v1/attendance/summaries?period=2026-11  attendance.read
POST   /api/v1/attendance/summaries/generate        attendance.summary.close
PATCH  /api/v1/attendance/summaries/:id/close       attendance.summary.close
GET    /api/v1/attendance/reports/late?period=      attendance.read
GET    /api/v1/attendance/reports/summary-export    attendance.export
GET    /api/v1/attendance/shifts                    shift.read
POST   /api/v1/attendance/shifts/create             shift.create
PUT    /api/v1/attendance/shifts/:id/update         shift.update
DELETE /api/v1/attendance/shifts/:id/delete         shift.delete
GET    /api/v1/attendance/employee-shifts           shift.read
POST   /api/v1/attendance/employee-shifts/assign    shift.assign
GET    /api/v1/holidays?year=2026                   holiday.read
POST   /api/v1/holidays/create                      holiday.manage
PUT    /api/v1/holidays/:id/update                  holiday.manage
DELETE /api/v1/holidays/:id/delete                  holiday.manage
```

### Permission baru

`attendance.read`, `attendance.read_self`, `attendance.record_self`, `attendance.update`, `attendance.export`, `attendance.adjust.request`, `attendance.adjust.decide`, `attendance.summary.close`, `shift.read`, `shift.create`, `shift.update`, `shift.delete`, `shift.assign`, `holiday.read`, `holiday.manage`

Karena skala di bawah 50 karyawan, laporan keterlambatan dan rekap kehadiran dihitung on-demand dari `attendance_logs`. Tidak perlu tabel ringkasan harian: satu agregasi atas ratusan baris per bulan selesai di bawah satu milidetik, dan ringkasan harian hanya menjadi salinan data yang bisa basi. Yang tetap disimpan hanyalah `attendance_summaries` bulanan, karena angka itu menjadi input payroll dan harus dibekukan.

---

## 4. Desain Payroll

Ini modul paling berisiko di seluruh roadmap. Angka gaji salah = kerugian finansial plus risiko hukum. Karena itu prinsipnya: **simpan komponen, jangan hardcode rumus pajak.**

### Tabel

**`salary_components`** (master) — `id`, `code`, `name`, `type` (`EARNING`/`DEDUCTION`), `calculation_type` (`FIXED`/`PERCENTAGE_OF_BASE`/`PER_HOUR`/`PER_DAY`/`VARIABLE`), `value` (decimal), `basis` (untuk percentage: base salary / gross), `is_taxable`, `bpjs_scheme` (nullable: `KESEHATAN`/`KESEHATAN_KELUARGA`/`KECELAKAAN`/`KEMATIAN`/`PUENSI`/`JHT`/`JP`), `bpjs_borne_by` (`EMPLOYEE`/`COMPANY`/`BOTH`), `bpjs_percentage` (nullable), `display_order`, `status`, timestamps.

**`salary_structures`** — `id`, `employee_id`, `effective_from`, `effective_to` (nullable), `base_salary` decimal(14,2), `currency` (default `IDR`), `pay_frequency` (`MONTHLY`/`WEEKLY`/`DAILY`), `status` (`DRAFT`/`ACTIVE`/`ARCHIVED`), `bank_name`, `bank_account_number`, `bank_account_holder`, `created_by`, timestamps. Unique: (`employee_id`, `effective_from`). Effective-dated — riwayat gaji wajib ada, jangan overwrite.

Kolom `currency` dipertahankan dengan default `IDR` dan tidak pernah divariasikan di v1: satu kolom murah yang menghindarkan migrasi kalau nanti ada cabang luar negeri. Jangan bangun konversi kurs, laporan per mata uang, atau validasi multi-currency — itu skop tanpa pengguna.

**`employee_salary_components`** — `id`, `structure_id`, `component_id`, `value_override` (nullable). Override per karyawan atas komponen master.

**`pay_periods`** — `id`, `name`, `start_date`, `end_date`, `pay_date`, `status` (`OPEN`/`CLOSED`/`PAID`), timestamps.

**`payroll_runs`** — `id`, `period_id`, `scope_type` (`ALL`/`BRANCH`/`DEPARTMENT`/`EMPLOYEE_LIST`), `scope_value`, `status` (`DRAFT`/`CALCULATED`/`PENDING_APPROVAL`/`APPROVED`/`PAID`/`VOIDED`), `item_count`, `total_gross`, `total_deduction`, `total_net`, `calculated_at`, `approved_by`, `approved_at`, `paid_by`, `paid_at`, `voided_by`, `voided_at`, `voided_reason`, `created_by`, timestamps.

**`payroll_items`** — `id`, `run_id`, `employee_id`, `structure_id`, `base_salary_snapshot`, `attendance_summary_snapshot` (jsonb), `gross`, `total_earning`, `total_deduction`, `net_pay`, `notes`. **Immutable.**

**`payroll_item_lines`** — `id`, `item_id`, `component_id`, `component_code_snapshot`, `label_snapshot`, `side` (`EARNING`/`DEDUCTION`), `amount`, `quantity`, `rate`, `source` (`STRUCTURE`/`ATTENDANCE`/`VARIABLE`/`MANUAL`), `display_order`.

**`variable_pay`** — `id`, `employee_id`, `period_id`, `type` (`OVERTIME`/`BONUS`/`COMMISSION`/`REIMBURSEMENT`/`ALLOWANCE_ADHOC`/`PENALTY`), `component_id` (nullable), `amount`, `quantity`, `note`, `status` (`PENDING`/`APPROVED`/`REJECTED`/`INCLUDED`), `approved_by`, `included_run_id` (nullable), timestamps.

### Aturan yang harus ditegakkan

1. **`payroll_items` dan `payroll_item_lines` tidak boleh punya endpoint update atau delete.** Sekali run di-calculate, barisnya dibekukan. Koreksi = run baru atau void lalu regenerate. Tidak ada pengecualian.
2. **Snapshot semua yang dipakai menghitung.** Struktur gaji, komponen, dan attendance summary disalin ke item saat calculate. Kalau HR mengubah struktur bulan depan, slip bulan ini tidak boleh ikut berubah.
3. **Pemisahan tugas (segregation of duties).** Pengguna yang membuat/menghitung run tidak boleh menjadi approver yang sama, dan tidak boleh menjadi penanda lunas. Paksa di controller, bukan di frontend. Ini kontrol internal dasar untuk sistem gaji; kalau tidak ada, audit eksternal langsung gagal.
4. **`VOIDED` menyimpan barisnya.** Jangan hapus. Set `voided_by`, `voided_at`, `voided_reason`. `variable_pay` yang sudah `INCLUDED` di run void dikembalikan ke `APPROVED` supaya bisa dipakai lagi.
5. **`variable_pay` tidak boleh masuk dua kali.** Unique partial index pada `included_run_id` plus status `INCLUDED`, atau flag saja tanpa index pun harus dicek di service: satu baris hanya boleh diserap satu run.
6. **Decimal, bukan float.** `decimal(14,2)`. Pembulatan hanya dilakukan di total akhir, tidak per baris, supaya jumlah baris sama dengan total.
7. **Prorata karyawan masuk/keluar di tengah bulan** dihitung dari hari kerja sesuai shift, bukan hari kalender. Sudah diputuskan: hari kerja efektif. Hari libur dari tabel `holidays` mengurangi pembagi, dan cuti bersama tidak memotong saldo. Lembur hari libur diambil dari `holiday_worked_hours` pada snapshot absensi dan menjadi baris sendiri dengan rate libur, terpisah dari lembur biasa. Karena sumbernya absensi, lembur hari libur tidak lewat `variable_pay` — satu angka dengan dua jalur masuk adalah cara paling pasti untuk membayar ganda.
8. **BPJS dua sisi disimpan.** Persentase perusahaan dan persentase karyawan adalah baris berbeda. Mencampur keduanya membuat laporan biaya tenaga kerja salah total.
9. **PPh 21 tidak dihitung di v1. Sudah diputuskan.** HR memasukkan pajaknya sebagai komponen `DEDUCTION` dengan `calculation_type = VARIABLE` atau `MANUAL`. Sistem menjumlahkan, bukan menghitung pajak. Engine pajak masuk Tier 2, terpisah, dengan test sendiri.
10. Semua operasi run dicatat ke audit log, termasuk nilai sebelum/sesudah untuk `MANUAL` override.
11. **Payroll dan slip gaji disimpan 10 tahun** (§9.1 poin 12), selaras kewajiban penyimpanan data perpajakan. Run lama tidak boleh ikut terhapus saat karyawan berhenti: `payroll_items` adalah bukti bayar, dan karyawan yang keluar masih bisa menuntut atau diperiksa mundur. Baris payroll tidak pernah di-purge oleh scheduler; kalau penyimpanan jadi masalah, pindahkan run lama ke mode arsip baca-saja, jangan dihapus.

### Endpoint

```
GET/POST/PUT/DELETE  /api/v1/payroll/components        payroll.component.manage
GET                  /api/v1/payroll/structures        payroll.read
POST                 /api/v1/payroll/structures/create payroll.structure.manage
PUT                  /api/v1/payroll/structures/:id    payroll.structure.manage
GET                  /api/v1/payroll/structures/:id/history  payroll.read
GET/POST             /api/v1/payroll/periods           payroll.read / payroll.period.manage
GET                  /api/v1/payroll/variable-pay      payroll.read
POST                 /api/v1/payroll/variable-pay      payroll.variable.manage
PATCH                /api/v1/payroll/variable-pay/:id/decision  payroll.variable.approve
POST                 /api/v1/payroll/runs/calculate    payroll.run.create
GET                  /api/v1/payroll/runs              payroll.read
GET                  /api/v1/payroll/runs/:id          payroll.read
POST                 /api/v1/payroll/runs/:id/recalculate  payroll.run.create
PATCH                /api/v1/payroll/runs/:id/submit   payroll.run.create
PATCH                /api/v1/payroll/runs/:id/approve  payroll.run.approve
PATCH                /api/v1/payroll/runs/:id/pay      payroll.run.pay
PATCH                /api/v1/payroll/runs/:id/void     payroll.run.void
GET                  /api/v1/payroll/runs/:id/items    payroll.read
GET                  /api/v1/payroll/runs/:id/export   payroll.export
GET                  /api/v1/payroll/my-payslips       payroll.payslip.read_self
GET                  /api/v1/payroll/payslips/:id      payroll.payslip.read_self
GET                  /api/v1/payroll/payslips/:id/export  payroll.payslip.read_self
GET                  /api/v1/payroll/reports/cost-summary  payroll.read
```

Catatan rute: `GET /api/v1/payroll/payslips/:id` harus memverifikasi bahwa `:id` milik pengguna yang meminta. Endpoint self-service dengan path ber-ID adalah tempat paling sering terjadi kebocoran horizontal (IDOR). Cek kepemilikan di controller, jangan hanya mengandalkan permission.

### Permission baru

`payroll.read`, `payroll.export`, `payroll.component.manage`, `payroll.structure.manage`, `payroll.period.manage`, `payroll.run.create`, `payroll.run.approve`, `payroll.run.pay`, `payroll.run.void`, `payroll.variable.manage`, `payroll.variable.approve`, `payroll.payslip.read_self`

### Test yang wajib ada

Payroll tanpa test bukan pilihan. Minimal: satu test per `calculation_type`, prorata masuk/keluar, shift midnight, void lalu regenerate, `variable_pay` tidak dobel serap, pemisahan tugas ditolak, dan jumlah `payroll_item_lines` sama dengan `gross`/`total_deduction`/`net_pay`.

---

## 5. Desain ESS

Yang bisa dilakukan karyawan sendiri, dengan permission `*_self` sehingga tidak butuh akses data orang lain.

- Lihat dan ubah profil sendiri. Field sensitif (`address`, `phone_number`, rekening bank, data darurat) **tidak langsung tersimpan**; masuk antrean verifikasi HR.
- Riwayat absensi sendiri + ajukan koreksi (lewat `attendance_adjustments`).
- Pengajuan dan riwayat cuti — sebagian besar sudah ada, tinggal memakai permission `leave_request.*` yang sudah ada.
- Slip gaji sendiri (`payroll.payslip.read_self`).
- Unggah dokumen pribadi (`document.upload`).
- Preferensi notifikasi.

### Tabel tambahan

**`employee_profile_changes`** — `id`, `employee_id`, `field`, `old_value`, `new_value`, `status` (`PENDING`/`APPLIED`/`REJECTED`), `requested_by` (user id), `reviewed_by`, `reviewed_at`, `review_note`.

Alasan: field profil tidak boleh diubah sendiri tanpa jejak. Simpan usulan, terapkan ke `employees` hanya setelah HR setujui. Ini juga menjawab kebutuhan audit.

**`notification_preferences`** — `id`, `user_id`, `channel` (`IN_APP`/`EMAIL`), `event_type`, `enabled`.

---

## 6. Desain Manajemen Dokumen

Modul dengan risiko kebocoran data tertinggi, karena isinya KTP, NPWP, ijazah, kontrak.

### Tabel

**`document_types`** — `id`, `code`, `name`, `category` (`IDENTITY`/`EDUCATION`/`CONTRACT`/`TAX`/`INSURANCE`/`CERTIFICATION`/`OTHER`), `is_mandatory`, `requires_verification`, `validity_months` (nullable, untuk menghitung kedaluwarsa otomatis), `status`, timestamps.

**`employee_documents`** — `id`, `employee_id`, `document_type_id`, `title`, `file_key`, `original_filename`, `mime_type`, `size_bytes`, `issued_at`, `expires_at`, `document_number` (nullable, misal nomor NPWP), `status` (`UPLOADED`/`VERIFIED`/`REJECTED`/`EXPIRED`), `uploaded_by`, `verified_by`, `verified_at`, `rejection_reason`, timestamps, `deleted_at` (soft delete, konsisten dengan modul lain).

### Aturan

1. File disimpan di bucket **S3-compatible yang privat** (Cloudflare R2, AWS S3, atau Supabase Storage). Download hanya lewat endpoint terautentikasi yang memeriksa permission lalu **menyalirkan file dari S3 ke respons** (stream proxy). Jangan memakai presigned URL sebagai jawaban utama: URL itu publik selama masa berlakunya, jadi bocor lewat riwayat browser atau log, dan izinnya tidak lagi dicek aplikasi. `file_key` menyimpan object key, bukan URL.
2. Validasi MIME type **dan** ekstensi **dan** ukuran maksimum. Tolak `.exe`, `.svg`, dan file dengan MIME samaran. Jangan percaya `original_filename`.
3. `document_number` (NPWP, nomor KTP) adalah data pribadi terklasifikasi sensitif. Enkripsi di aplikasi untuk kolom ini, atau setidaknya batasi permission baca ke `payroll`/HR saja dan catat setiap aksesnya.
4. Scheduler harian memindai `expires_at` dan memicu notifikasi pada H-30, H-14, H-7, dan saat kedaluwarsa, lalu menandai status `EXPIRED`.
5. Soft delete saja. Tidak ada hard delete dokumen kontrak — dokumen itu bukti hukum.
6. **Retensi 10 tahun setelah karyawan berhenti.** Sudah diputuskan. Scheduler tahunan memindai karyawan dengan `employment_status` selain `ACTIVE` yang sudah melewati 10 tahun sejak tanggal berhenti, lalu menandai dokumennya `ARCHIVED`. Penghapusan objek di R2 **tidak** dijalankan otomatis dari kode — purge fisik harus menjadi keputusan manusia dengan catatan persetujuan, karena sekali objek hilang tidak ada pemulihan. Batasi retensi 10 tahun ini pada payroll dan dokumen; data kontak dan riwayat dasar tidak perlu selama itu.
7. Tanggal berhenti yang dipakai menghitung retensi adalah `contract_end_date` atau tanggal status non-ACTIF terakhir, bukan `deleted_at`. Kalau keduanya kosong, jangan bersihkan — tandai untuk tinjauan manual. Kesalahan di sini menghapus bukti hukum karyawan yang masih punya hak.

### Endpoint

```
GET    /api/v1/documents                      document.read
POST   /api/v1/documents/upload               document.upload        (multipart)
GET    /api/v1/documents/:id/detail           document.read
GET    /api/v1/documents/:id/download         document.download
PATCH  /api/v1/documents/:id/verify           document.verify
PATCH  /api/v1/documents/:id/reject           document.verify
DELETE /api/v1/documents/:id/delete           document.delete
GET    /api/v1/documents/expiring?days=30     document.read
GET    /api/v1/documents/checklists/:employee_id  document.read
GET    /api/v1/document-types                 document.read
POST/PUT/DELETE /api/v1/document-types/*      document.type.manage
```

Dependensi baru: `multer` (atau `@aws-sdk/lib-storage` untuk upload stream) plus satu klien S3. Penyimpanan lokal tidak dibangun sama sekali — disk Railway bersifat sementara dan hilang saat redeploy, jadi implementasi disk hanya menjadi kode yang tidak pernah dipakai di produksi. Kredensial bucket masuk environment variable Railway, bukan repo.

---

## 7. Urutan eksekusi

Urutan ini dipilih karena ketergantungan datanya, bukan karena mudah.

**Fase 0 — Tautan User ↔ Employee dan aktor sistem.** Prasyarat semua fase. Detail di `hris-phase-implementation-plan.md` §2.

**Fase 1 — Fondasi (Tier 0).** Refresh token, scheduler, notifikasi. Detail di plan §3.
2. Refresh token + revocation sesi.
3. Scheduler (`node-cron`).
4. Notifikasi inti: tabel + in-app + satu kanal email.

**Fase 2 — Rantai approval cuti dua tingkat.** Desain di bawah. Terpisah dari absensi karena mengubah modul yang sudah berjalan dan membutuhkan migrasi data.

**Fase 3 — Absensi & Shift.** Input utama payroll.

**Fase 4 — Payroll.** Butuh `attendance_summaries` dari Fase 3 dan scheduler dari Fase 1 untuk penutupan periode.

**Fase 5 — ESS + Dokumen.** Butuh payslip (Fase 4) supaya ESS punya isi yang berguna, dan butuh notifikasi (Fase 1) untuk alert kedaluwarsa serta verifikasi profil.

**Fase 6 — Tier 2,** dipilih sesuai kebutuhan pasar, bukan semuanya sekaligus.

Alasan payroll tidak didahulukan: gaji yang benar menuntut data kehadiran yang benar. Membangun payroll sebelum absensi membuat angka prorata dan potongan tidak hadir tidak punya sumber.

Alasan rantai approval didahulukan dari absensi: skalanya kecil, hanya menyentuh modul leave yang sudah ada, dan langsung memakai notifikasi dari Fase 1. Menunda perubahan perilaku yang sudah disetujui justru membuat ia bertabrakan dengan kode absensi nanti.

### Desain Fase 2: rantai approval cuti dua tingkat

Sekarang status permohonan ditentukan oleh role pengguna yang memanggil endpoint. Diganti menjadi dua tingkat: atasan langsung, lalu HR.

**Tabel `leave_requests`, kolom tambah:**
- `current_level` (`LEVEL_1`/`LEVEL_2`) — tingkat yang sedang memegang permohonan.
- `level_1_employee_id` — atasan yang ditugaskan. Diisi saat dibuat, dari `employee.manager_id`.
- `level_1_decided_by`, `level_1_decided_at`, `level_1_note`.
- `level_2_decided_by`, `level_2_decided_at`, `level_2_note`.

Rantai tidak dibekukan sebagai JSON di setiap baris. Alasannya: kalau dibekukan, pergantian atasan di tengah jalan tidak bisa ditindaklanjuti tanpa memperbaiki data historis.

**Penyelesaian atasan saat permohonan dibuat:**
1. `employee.manager_id` ada dan manajernya aktif → `current_level = LEVEL_1`, `level_1_employee_id = manager_id`.
2. Manager kosong, tidak aktif, atau manajernya sendiri yang mengajukan → `current_level = LEVEL_2` (langsung ke HR).
3. Atasan sedang cuti pada tanggal keputusan → tetap LEVEL_1, tapi scheduler mengirim pengingat; eskalasi otomatis ke HR setelah N hari tanpa keputusan (N konfigurasi, default 3).

**Aturan penegakan di controller:**
1. Pengguna hanya boleh memutuskan pada tingkat yang sedang aktif. LEVEL_1 hanya bisa diputuskan oleh `level_1_employee_id`; LEVEL_2 hanya oleh pemegang `leave_request.decide`. Menolak dengan 403, bukan menyembunyikan tombol saja.
2. Approver tidak boleh memutuskan permohonannya sendiri. Karyawan tanpa atasan otomatis naik ke HR, bukan memegang permohonannya sendiri.
3. Permohonan yang ditolak di LEVEL_1 berhenti; tidak naik ke LEVEL_2. Pemohon bisa mengedit lalu mengajukan ulang (status jadi `PENDING` baru dengan tingkat reset).
4. Saldo cuti dikurangi hanya setelah keputusan tingkat terakhir menyetujui. Perilaku ini sudah ada dan jangan berubah.
5. Perpindahan tingkat mengirim notifikasi (Fase 1).
6. Setiap keputusan tingkat dicatat ke audit log, termasuk siapa dan kapan.

**Migrasi data (urutan wajib):**
1. Tambah kolom dengan nilai default aman: semua permohonan `PENDING` → `current_level = LEVEL_2`, `level_1_employee_id = NULL`. Ini mempertahankan perilaku sekarang (HR yang memutuskan) sampai rantai aktif.
2. Isi `level_1_employee_id` untuk permohonan baru saja; jangan mencoba menelusuri riwayat permohonan lama.
3. Permohonan `APPROVED`/`REJECTED` historis dibiarkan apa adanya; kolom tingkat terisi `NULL` dan dibaca sebagai "diputuskan dengan aturan lama". Jangan menulis ulang sejarah audit.
4. Setelah migrasi jalan, aktifkan pengecekan tingkat lewat satu gerbang di service, bukan sebaran `if` di controller.

**Permission baru:** `leave_request.decide` tetap untuk HR. Tambahkan `leave_request.decide_direct_report` untuk atasan, sehingga atasan tidak perlu memegang `leave_request.read` penuh yang membuka data cuti seluruh perusahaan. `leave_request.read` untuk atasan dibatasi pada baris miliknya sendiri: filter `level_1_employee_id = <employee user>` atau `employee_id` di bawah koordinasinya.

---

## 8. Tanda centang "layak HRIS"

Sebelum mengklaim HRIS, semua ini harus lolos di produksi:

- [ ] Karyawan bisa check-in/check-out setiap hari, termasuk shift yang melewati tengah malam.
- [ ] Atasan langsung bisa menyetujui cuti timnya, dan hanya melihat cuti timnya — bukan cuti seluruh perusahaan.
- [ ] Permohonan tanpa atasan otomatis jatuh ke HR, dan tidak ada karyawan yang memegang persetujuan untuk dirinya sendiri.
- [ ] Hari cuti yang disetujui muncul sebagai kehadiran, bukan ketidakhadiran.
- [ ] HR bisa menutup satu periode absensi dan angkanya tidak berubah lagi setelah ditutup.
- [ ] HR bisa membangkitkan satu run gaji bulanan dari struktur gaji + absensi + pembayaran variabel.
- [ ] Run gaji tidak bisa disetujui oleh orang yang sama yang menghitungnya.
- [ ] Karyawan bisa mengunduh slip gaji miliknya sendiri, dan tidak bisa mengunduh slip orang lain.
- [ ] Riwayat struktur gaji terjaga: mengubah gaji bulan depan tidak mengubah slip bulan lalu.
- [ ] Dokumen wajib per karyawan terpantau, dan kedaluwarsa memicu notifikasi sebelum terjadi.
- [ ] Kontrak yang habis dalam 30 hari memicu notifikasi ke HR.
- [ ] Setiap perubahan data gaji dan dokumen punya jejak audit yang bisa diekspor.
- [ ] Karyawan bisa mengajukan perubahan profil, dan HR bisa menyetujuinya.
- [ ] Ada test otomatis untuk perhitungan gaji (§4 daftar test).
- [ ] Backup dan restore database sudah diuji sekali secara nyata, bukan hanya dikonfigurasi.
- [ ] Hari libur nasional dan cuti bersama tahun berjalan sudah diisi, dan cuti bersama tidak memotong saldo cuti.
- [ ] Kerja pada hari libur menghasilkan baris lembur bertarif libur, bukan lembur biasa.
- [ ] Dokumen karyawan tersimpan di bucket privat dan hanya bisa diambil lewat endpoint terautentikasi; tidak ada URL publik yang bocor ke log.
- [ ] Data karyawan yang berhenti ditandai arsip pada 10 tahun, dan tidak ada jalur kode yang menghapus objek secara otomatis.
- [ ] Daftar permission di README diperbarui dan OpenAPI mencantumkan permission per endpoint (sudah unchecked di README).

---

## 9. Keputusan

### 9.1 Sudah ditetapkan

Keputusan berikut sudah diambil dan seluruh dokumen mengikuti isinya. Mengubah salah satunya berarti mengubah skema, jadi jangan diubah di tengah implementasi.

| # | Keputusan | Konsekuensi teknis |
|---|---|---|
| 1 | Internal satu perusahaan, bukan SaaS multi-tenant | Tidak ada kolom `tenant_id`, tidak ada isolasi query, tidak ada langganan atau billing. Skema tetap bisa dipisah nanti, tapi itu migrasi besar — bukan sesuatu yang dihindari gratis. |
| 2 | Payroll v1 memakai komponen manual; tanpa engine PPh 21 dan BPJS | §4 aturan 9. Pajak dan iuran dimasukkan HR sebagai baris `DEDUCTION`. Engine pajak tetap Tier 2 dengan test sendiri. |
| 3 | Absensi hanya lewat web | `source` menyusut jadi `WEB`/`API`/`HR_CORRECTION`. Kolom `latitude`, `longitude`, `device_info` tetap dibuat tapi `NULL`. Tidak ada aplikasi mobile, tidak ada validasi radius, tidak ada deteksi lokasi palsu. |
| 4 | Approval cuti dua tingkat: atasan langsung lalu HR | Fase 2 (§7) dengan migrasi data leave dan permission baru `leave_request.decide_direct_report`. |
| 5 | Satu zona waktu (`Asia/Jakarta`) dan satu mata uang (`IDR`) | Zona waktu jadi konstanta config, bukan kolom `branches.timezone`. Kolom `currency` tetap ada dengan default `IDR`, tapi tanpa konversi kurs dan tanpa laporan per mata uang. |
| 6 | File dokumen di bucket S3-compatible privat | Tidak ada implementasi disk lokal. Download lewat stream proxy dari endpoint terautentikasi, bukan presigned URL. |
| 7 | Prorata memakai hari kerja efektif sesuai shift | §4 aturan 7. Bergantung pada `employee_shifts` yang benar, jadi absensi harus selesai lebih dulu. |
| 8 | Batas tanggal absensi mengikuti tanggal mulai shift | §3 aturan 1. Menyelesaikan kasus shift yang melewati tengah malam. |
| 9 | Skala di bawah 50 karyawan, beberapa cabang, semua WIB | `node-cron` satu instance cukup. Queue tidak dibangun. Laporan kehadiran dan keterlambatan dihitung on-demand dari `attendance_logs`; hanya ringkasan bulanan yang disimpan, karena itu input payroll. |
| 10 | Hari libur nasional dan cuti bersama lewat tabel `holidays` terpisah | §3. Bukan ditanam di `shifts.work_days` dan bukan di kode. Cuti bersama tidak memotong saldo, dan kerja di hari libur memakai tarif libur yang terpisah dari lembur biasa. |
| 11 | Rantai approval cuti langsung aktif setelah migrasi | §7 Fase 2. Permohonan baru menuju atasan; permohonan `PENDING` warisan tetap di HR sampai selesai. Tidak ada mode pilot dan tidak ada satu siklus tunggu. |
| 12 | Retensi payroll dan dokumen 10 tahun setelah karyawan berhenti | §4 aturan 11 dan §6 aturan 6. Penandaan arsip dilakukan scheduler; penghapusan fisik objek tidak pernah otomatis dari kode. |
| 13 | File dokumen di Cloudflare R2 | §6. Klien S3 dengan endpoint khusus R2. Egress gratis, jadi download massal tidak dikenai biaya keluar. Tidak ada implementasi penyimpanan lokal. |
| 14 | Implementasi dimulai dari Fase 1 (fondasi) | §7. Tidak ada jalan pintas ke absensi, jadi scheduler dan notifikasi sudah tersedia saat absensi membutuhkannya. |

### 9.2 Masih terbuka

Semua keputusan arsitektur sudah tertutup. Yang tersisa adalah kebijakan angka dan pemilik proses, bukan struktur data — semuanya bisa diubah nanti tanpa migrasi.

1. **Tarif lembur hari libur.** Kelipatan berapa (2x, 3x, atau sesuai ketentuan per jam) belum ditetapkan. Desain sudah memisahkannya sebagai baris sendiri, jadi angka ini tinggal diisi sebagai komponen `PER_HOUR`.
2. **Ambang eskalasi atasan.** Default 3 hari tanpa keputusan lalu naik ke HR. Perlu dikonfirmasi ke HR, dan sebaiknya menjadi konfigurasi, bukan konstanta kode.
3. **Penutup LEVEL_2.** Kalau pemegang `leave_request.decide` sedang cuti atau berhenti, permohonan menggantung. Perlu satu nama cadangan atau aturan "siapa pun dengan permission HR boleh memutuskan".
4. **Kanal email untuk notifikasi.** Provider belum dipilih (Resend, SES, atau SMTP). Tidak memengaruhi skema: hanya satu tabel antrean plus satu klien.
5. **Disbursement gaji.** Apakah payroll perlu menghasilkan berkas transfer bank, atau cukup ekspor Excel yang diunggah manual ke mobile banking. Ekspor Excel sudah masuk desain; berkas transfer tidak.
6. **Pemilik retensi.** Siapa yang boleh menyetujui penghapusan fisik dokumen setelah 10 tahun. Tanpa nama, aturan §6 aturan 6 tidak akan pernah dijalankan.

---

## 10. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Perhitungan gaji salah | Kerugian finansial, sengketa ketenagakerjaan | Test wajib per tipe perhitungan, snapshot, immutability, pemisahan tugas, tidak ada engine pajak di v1 |
| Kebocoran data pribadi (KTP, NPWP, gaji, kesehatan) | Pelanggaran UU PDP No. 27/2022, denda dan reputasi | Bucket R2 privat, download lewat stream proxy terautentikasi, cek kepemilikan di semua endpoint `*_self`, enkripsi kolom identitas, audit akses |
| Purge retensi 10 tahun salah eksekusi | Bukti hukum dan hak karyawan hilang tanpa pemulihan | Scheduler hanya menandai `ARCHIVED`; penghapusan fisik objek butuh persetujuan manusia dan nama penanggung jawab (§9.2 poin 6) |
| Cron duplikat saat scale | Notifikasi dobel, penutupan periode dobel | Skala di bawah 50 jadi satu instance dan `node-cron` cukup; kalau bertambah, pindah BullMQ + Redis. Catat batas ini di kode sebagai `shortcut:` |
| Absensi midnight salah tanggal | Angka kehadiran dan payroll salah permanen | Simpan `attendance_date` eksplisit dari shift, jangan turunkan dari timestamp server |
| Hari libur salah isi | Prorata dan tuntutan absensi seluruh perusahaan berubah | `holidays` punya unique pada tanggal, perubahan dicatat ke audit log, dan pengisian libur tahunan ditinjau HR sebelum periode payroll ditutup |
| Perubahan rantai approval cuti | Memaksa migrasi data leave yang sudah ada | Fase 2 sendiri (§7), semua `PENDING` diarahkan ke LEVEL_2 saat migrasi, jangan digabung dengan pembangunan absensi |
| Atasan tidak ada atau sedang cuti | Permohonan menggantung, karyawan tetap masuk tanpa keputusan | Eskalasi otomatis ke HR setelah ambang hari tanpa keputusan (default 3); manager kosong langsung ke LEVEL_2; penutup LEVEL_2 masih perlu nama (§9.2 poin 3) |
| Presigned URL dipakai untuk download dokumen | URL bocor lewat riwayat browser dan log, izin tidak lagi dicek aplikasi | Stream proxy dari endpoint terautentikasi (§6 aturan 1) |
| Download dokumen membebani instance | Respons lain melambat saat penarikan massal | Egress R2 gratis, jadi biarkan file mengalir lewat instance selama skala internal; kalau jadi hambatan, tambah CDN privat, jangan presigned URL publik |
| Scope melebar ke Tier 2 | Tidak ada satu pun pilar HRIS selesai | Kunci Fase 1–5, Tier 2 hanya atas permintaan pasar |

---

## 11. Yang sengaja tidak diusulkan

- **Queue/bus pesan (RabbitMQ, Kafka).** Belum ada kebutuhan fan-out nyata. Notifikasi in-app cukup ditulis sinkron; email lewat satu tabel antrean sederhana yang discheduler.
- **Microservice atau pemisahan modul jadi app terpisah.** Skala belum menuntut. Struktur `src/modules/*` yang ada sudah tepat.
- **Engine PPh 21 dan kalkulator BPJS internal.** Ditunda ke Tier 2 dengan alasan di §9.1 poin 2.
- **Penyimpanan file lokal.** Sudah diputuskan Cloudflare R2 (§9.1 poin 13). Disk Railway sementara, jadi implementasi lokal hanya menjadi kode mati di produksi.
- **Multi-tenant.** Sudah dijawab: internal satu perusahaan (§9.1 poin 1). Tidak ada `tenant_id`, tidak ada isolasi query, tidak ada langganan. Kalau nanti berubah jadi SaaS, itu proyek migrasi sendiri dan bukan penambahan kolom.
- **Aplikasi mobile, kiosk, validasi GPS, dan foto selfie saat absen.** Sudah dijawab: web saja (§9.1 poin 3). Ini menghapus sekaligus kebutuhan mock-location detection, kebijakan radius, dan aplikasi mobile.
- **Konversi kurs dan laporan per mata uang.** Sudah dijawab: `IDR` saja (§9.1 poin 5).
- **Kolom `timezone` dan `currency` per cabang.** Sudah dijawab: satu zona waktu (§9.1 poin 5). Zona waktu jadi konstanta config.
- **Rantai approval tiga tingkat atau berjenjang dinamis.** Dua tingkat cukup (atasan, lalu HR). Chain panjang menuntut konfigurasi per department, delegasi saat cuti, dan debug yang tidak sebanding dengan jumlah karyawan saat ini.
- **Ringkasan absensi harian dan tabel precompute apa pun.** Skala di bawah 50 karyawan (§9.1 poin 9). Agregasi on-demand atas beberapa ratus baris per bulan tidak terasa, sedangkan ringkasan harian adalah salinan yang bisa basi dan wajib dijaga konsistensinya tiap ada koreksi.
- **Mode pilot atau grayscale untuk rantai approval.** Sudah dijawab: langsung aktif (§9.1 poin 11). Satu gerbang di service sudah cukup untuk mengendalikan perilaku; kerucutkan rilis lewat fitur flag tidak diperlukan pada jumlah pengguna ini.
- **Berkas transfer bank untuk disbursement gaji.** Ekspor Excel dari run payroll sudah ada. Berkas format bank belum diminta dan berbeda-beda per bank, jadi tiap format adalah pekerjaan perawatan tersendiri (§9.2 poin 5).
