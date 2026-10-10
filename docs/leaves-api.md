# Leaves API: panduan integrasi frontend

Dokumen ini menjelaskan endpoint Leaves yang tersedia untuk integrasi FE. Kontrak OpenAPI lengkap tersedia pada `/api-docs/openapi.json`.

## Dasar integrasi

- Base path: `/api/v1/leaves`
- Semua endpoint membutuhkan autentikasi. Kirim `Authorization: Bearer <token>`; cookie sesi yang dipakai oleh API juga didukung.
- FE hanya akan berhasil memanggil endpoint jika role pengguna memiliki permission terkait. Seeder permission Leaves memberikan akses ke role `ADMIN` dan `HR`.
- Semua respons mengikuti format umum:

```json
{
  "success": true,
  "message": "success",
  "metadata": {},
  "data": {}
}
```

- List mengembalikan array pada `data` dan pagination di `metadata`: `per_page`, `current_page`, `total_row`, `total_page`.
- Error berisi `success: false` dan pesan pada `message`. Status yang umum: `400` validasi/input, `401` belum login, `403` permission tidak cukup, `404` data tidak ditemukan, `409` konflik bisnis.
- ID dikirim sebagai string. Tanggal memakai format `YYYY-MM-DD`; timestamp keputusan berupa tanggal/waktu ISO.
- Nilai `DECIMAL` yang dikembalikan database dapat berupa string numerik. FE sebaiknya mengonversinya ke number untuk kalkulasi/tampilan, dan tetap mengirim number di request body.

## Endpoint

### Jenis cuti

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/types` | `leave_type.read` | Daftar jenis cuti, paginated |
| GET | `/types/:id/detail` | `leave_type.read` | Detail beserta saldo karyawan terkait |
| POST | `/types/create` | `leave_type.create` | Tambah jenis cuti |
| PUT | `/types/:id/update` | `leave_type.update` | Ubah satu atau beberapa field |
| DELETE | `/types/:id/delete` | `leave_type.delete` | Hapus jika belum digunakan request/saldo |

Query list:

- `page` (default `1`), `per_page` (default `10`, maksimum `100`), `q` (pencarian nama), `is_active` (`true`/`false`).

Contoh body create:

```json
{
  "name": "Annual Leave",
  "description": "Cuti tahunan",
  "annual_quota": 12,
  "requires_balance": true,
  "color": "#2563EB",
  "is_active": true
}
```

`name` wajib. `annual_quota` boleh `null`; `color` harus hex `#RRGGBB`. Field yang tidak dikirim menggunakan default database. Update membutuhkan minimal satu field. Jenis cuti yang sudah punya request atau saldo tidak dapat dihapus; perubahan `requires_balance` juga ditolak setelah jenis tersebut digunakan.

Jenis cuti contoh (Annual Leave, Sick Leave, Unpaid Leave, Maternity Leave, Paternity Leave) tersedia melalui seeder jenis cuti.

### Pengajuan cuti

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/requests` | `leave_request.read` | Daftar pengajuan, paginated |
| GET | `/requests/:id/detail` | `leave_request.read` | Detail dengan employee, jenis cuti, dan approver |
| POST | `/requests/create` | `leave_request.create` | Buat pengajuan berstatus `PENDING` |
| PUT | `/requests/:id/update` | `leave_request.update` | Ubah pengajuan yang masih `PENDING` |
| DELETE | `/requests/:id/delete` | `leave_request.delete` | Hapus pengajuan yang masih `PENDING` |
| PATCH | `/requests/:id/decision` | `leave_request.decide` | Approve atau reject pengajuan `PENDING` |
| PATCH | `/requests/:id/cancel` | `leave_request.update` | Batalkan pengajuan `PENDING` atau `APPROVED` |

Query list:

- Pagination: `page`, `per_page`.
- Filter: `employee_id`, `leave_type_id`, `approver_id`, `status`, `start_date`, `end_date`.
- `status`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
- Jika `start_date`/`end_date` dikirim, hasil mencakup pengajuan yang rentang tanggalnya overlap dengan rentang filter.

Contoh body create:

```json
{
  "employee_id": "employee-id",
  "leave_type_id": "leave-type-id",
  "start_date": "2026-11-02",
  "end_date": "2026-11-04",
  "duration_days": 3,
  "reason": "Keperluan keluarga"
}
```

Field wajib: `employee_id`, `leave_type_id`, `start_date`, `end_date`, `duration_days`, `reason`. `approver_id` opsional. Jika tidak diberikan, API memakai `manager_id` dari employee; jika employee tidak memiliki manager, approver menjadi `null`.

Aturan FE:

- `end_date` harus sama dengan atau setelah `start_date`; tanggal harus valid.
- `duration_days` harus lebih besar dari `0` dan maksimum `999.99`.
- Hari kerja/libur **tidak** dihitung otomatis oleh API. FE mengirim `duration_days` eksplisit menurut aturan bisnis yang disepakati.
- Employee harus aktif dan employment status-nya `ACTIVE`; jenis cuti harus aktif.
- Request ditolak dengan `409` jika employee sudah memiliki request `PENDING` atau `APPROVED` yang tanggalnya overlap.
- Status dibuat server sebagai `PENDING`; jangan kirim `status`, `decided_by`, atau `decided_at` pada create/update.
- Hanya pengajuan `PENDING` yang dapat diubah atau dihapus.

Contoh body keputusan:

```json
{
  "status": "APPROVED",
  "decision_note": "Disetujui"
}
```

`status` hanya boleh `APPROVED` atau `REJECTED`. Keputusan mencatat user yang sedang login pada `decided_by` dan waktu pada `decided_at`. Untuk jenis cuti `requires_balance: true`, approval mengurangi saldo secara atomik. Saldo harus tersedia; untuk jenis berbasis saldo, tanggal mulai dan akhir harus dalam tahun kalender yang sama. Reject tidak menggunakan saldo.

Cancel menggunakan `PATCH /requests/:id/cancel` tanpa body. Jika request yang dibatalkan sudah `APPROVED` dan jenisnya memerlukan saldo, saldo terpakai dikembalikan. Request `REJECTED` atau `CANCELLED` tidak dapat dibatalkan lagi.

### Kalender

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/calendar` | `leave_request.read` | Daftar event cuti yang overlap dengan rentang kalender |

Query wajib: `start_date`, `end_date` (`YYYY-MM-DD`). Filter opsional: `employee_id`, `leave_type_id`, `status`. Status kalender hanya `PENDING` dan `APPROVED`; bila `status` tidak dikirim, keduanya disertakan. Respons `data` berupa array pengajuan dengan asosiasi `employee`, `leave_type` (termasuk `color`), dan `approver`.

Contoh:

```http
GET /api/v1/leaves/calendar?start_date=2026-11-01&end_date=2026-11-30&status=APPROVED
```

Event bisa melewati batas rentang kalender; FE sebaiknya melakukan clipping visual pada tampilan bulan/minggu, bukan mengasumsikan tanggal event selalu berada seluruhnya di dalam filter.

### Saldo cuti

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/balances` | `leave_balance.read` | Daftar saldo, paginated |
| GET | `/balances/:id/detail` | `leave_balance.read` | Detail dengan employee dan jenis cuti |
| POST | `/balances/create` | `leave_balance.create` | Buat saldo tahunan employee/jenis cuti |
| PUT | `/balances/:id/update` | `leave_balance.update` | Ubah alokasi atau penyesuaian |
| DELETE | `/balances/:id/delete` | `leave_balance.delete` | Hapus saldo jika `used_days` masih nol |

Filter list: `employee_id`, `leave_type_id`, `year`, serta `page` dan `per_page`.

Contoh body create:

```json
{
  "employee_id": "employee-id",
  "leave_type_id": "leave-type-id",
  "year": 2026,
  "allocated_days": 12,
  "adjustment_days": 0
}
```

Pasangan `employee_id` + `leave_type_id` + `year` harus unik. Nilai saldo yang ditampilkan:

```text
available_days = allocated_days + adjustment_days - used_days
```

API menyimpan/mengembalikan `allocated_days`, `adjustment_days`, dan `used_days`; `available_days` dihitung oleh FE. `used_days` dikelola oleh approval/cancel dan tidak dapat dikirim pada create/update. Alokasi plus penyesuaian tidak boleh lebih kecil dari `used_days`.

## Bentuk data yang digunakan FE

Pengajuan dalam list, detail, dan kalender menyertakan:

- `employee`: `id`, `employee_code`, `first_name`, `last_name`
- `leave_type`: `id`, `name`, `color`, `requires_balance`
- `approver`: `id`, `employee_code`, `first_name`, `last_name`, atau `null`
- Field utama: `id`, `employee_id`, `leave_type_id`, `approver_id`, `start_date`, `end_date`, `duration_days`, `reason`, `status`, `decision_note`, `decided_by`, `decided_at`, `created_at`, `updated_at`

Saldo menyertakan `employee` dan `leave_type` dengan ringkasan yang sama; nilai saldo sendiri adalah `allocated_days`, `adjustment_days`, `used_days`, dan `year`.

## Contoh penanganan error di FE

Gunakan HTTP status untuk alur umum dan tampilkan `message` dari API untuk penjelasan. Khusus `409`, misalnya jadwal bentrok, saldo tidak cukup, data duplikat, atau state request sudah berubah, refresh data terkait sebelum mencoba ulang. Setelah create/update/decision/cancel berhasil, refresh list, kalender, dan saldo yang sedang ditampilkan agar state tidak stale.
