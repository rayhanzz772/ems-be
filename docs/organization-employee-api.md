# Branch, Position, dan Employee API untuk FE

Panduan ini mencatat kontrak terbaru untuk integrasi frontend. Leaves API didokumentasikan terpisah di [`leaves-api.md`](./leaves-api.md). Kontrak OpenAPI tersedia di `/api-docs/openapi.json`.

## Integrasi umum

- Base URL lokal: `http://localhost:8000`
- Prefix endpoint: `/api/v1`
- Semua endpoint pada dokumen ini memerlukan autentikasi Bearer JWT atau cookie sesi.
- Otorisasi diperiksa per permission. Role hanya dapat mengakses endpoint jika permission yang sesuai telah diberikan.
- Respons standar berbentuk `{ "success": true, "message": "success", "metadata": {}, "data": ... }`. Untuk list, `data` adalah array; `metadata` berisi `per_page`, `current_page`, `total_row`, dan `total_page`.
- Gunakan `400` untuk memperlihatkan kesalahan validasi, `401` untuk meminta login, `403` untuk akses yang tidak diizinkan, `404` untuk data yang tidak ditemukan, dan `409` untuk konflik seperti foreign key atau data yang masih direferensikan.

## Branch

Prefix: `/api/v1/branches`

### Field Branch

| Field | Tipe | Nullable | Keterangan |
|---|---|---:|---|
| `id` | string | Tidak | Dibuat oleh server |
| `name` | string | Tidak | Maksimum 255 karakter |
| `address` | string | Ya | Maksimum 255 karakter |
| `status` | boolean | Tidak | Default `true`; status aktif |
| `created_at` | datetime | Tidak | Dibuat oleh server |
| `updated_at` | datetime | Tidak | Diperbarui oleh server |
| `employee_count` | number/string | — | Jumlah employee yang belum soft-delete; tersedia di list dan detail |

### Endpoint Branch

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/branches` | `branch.read` | Daftar branch |
| GET | `/branches/:id/detail` | `branch.read` | Detail dan `employee_count` |
| POST | `/branches/create` | `branch.create` | Buat branch |
| PUT | `/branches/:id/update` | `branch.update` | Ubah nama, alamat, atau status |
| DELETE | `/branches/:id/delete` | `branch.delete` | Hapus branch yang tidak dipakai employee |
| PATCH | `/branches/:id/status` | `branch.update` | Toggle status aktif/nonaktif; tanpa body |

List menerima `page` (default `1`), `per_page` (default `10`, maksimum `100`), `q` (cari nama/alamat), `status` (`true`/`false`), `sort_by` (`name`, `status`, `created_at`, `updated_at`), dan `sort_order` (`ASC`/`DESC`). Default sorting `created_at DESC`.

Body create:

```json
{
  "name": "Head Office",
  "address": "Jakarta"
}
```

`name` wajib dan di-trim. `address` boleh dihilangkan atau dikirim `null` untuk dikosongkan. Update menerima subset `name`, `address`, `status`, tetapi minimal satu field harus dikirim. Branch yang dipakai employee tidak bisa dihapus (`409`). Employee baru hanya dapat ditautkan ke branch aktif.

## Position

Prefix: `/api/v1/positions`

### Field Position

| Field | Tipe | Nullable | Keterangan |
|---|---|---:|---|
| `id` | string | Tidak | Dibuat oleh server |
| `name` | string | Tidak | Maksimum 255 karakter |
| `description` | string | Tidak | Maksimum 255 karakter |
| `created_at` | datetime | Tidak | Dibuat oleh server |
| `updated_at` | datetime | Tidak | Diperbarui oleh server |

### Endpoint Position

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/positions` | `position.read` | Daftar posisi |
| GET | `/positions/:id/detail` | `position.read` | Detail posisi |
| POST | `/positions/create` | `position.create` | Buat posisi |
| PUT | `/positions/:id/update` | `position.update` | Ubah nama/deskripsi |
| DELETE | `/positions/:id/delete` | `position.delete` | Hapus posisi yang tidak dipakai employee |

List menerima `page` (default `1`), `per_page` (default `10`, maksimum `100`), `q` (cari nama/deskripsi), `sort_by` (`name`, `created_at`, `updated_at`), dan `sort_order` (`ASC`/`DESC`). Default sorting `created_at DESC`.

Body create:

```json
{
  "name": "Software Engineer",
  "description": "Develops and maintains software"
}
```

Kedua field wajib, di-trim, dan tidak boleh kosong. Update menerima subset field, minimal satu harus dikirim. Posisi yang masih direferensikan employee tidak bisa dihapus (`409`).

## Employee

Prefix: `/api/v1/employees`

### Field Employee terkini

| Field | Tipe | Nullable | Keterangan |
|---|---|---:|---|
| `id` | string | Tidak | ID employee |
| `employee_code` | string | Tidak | Maksimum 50 karakter; dapat dibuat server jika tidak dikirim saat create |
| `first_name` | string | Tidak | Maksimum 100 karakter |
| `last_name` | string | Tidak | Maksimum 100 karakter |
| `email` | string | Tidak | Harus berformat email |
| `phone_number` | string | Tidak pada create | 8–20 karakter; angka dan `+()-`/spasi |
| `department_id` | string | Tidak | Referensi department |
| `position_id` | string | Tidak | Referensi `positions.id`; menggantikan nilai position berbentuk teks |
| `branch_id` | string | Ya | Referensi `branches.id`; menggantikan `work_location` |
| `manager_id` | string | Ya | Self-reference ke `employees.id`; tidak boleh membuat siklus pelaporan |
| `employment_type` | enum | Tidak | `PERMANENT`, `CONTRACT`, `INTERN`; default `PERMANENT` |
| `employment_status` | enum | Tidak | `ACTIVE`, `ON_LEAVE`, `RESIGNED`, `TERMINATED`; default `ACTIVE` |
| `contract_start_date` | date | Ya | Format `YYYY-MM-DD` |
| `contract_end_date` | date | Ya | Format `YYYY-MM-DD`; harus setelah/sama dengan start date |
| `status` | boolean | Tidak | Flag aktif/nonaktif; terpisah dari `employment_status`; default `true` |
| `hire_date` | date/datetime | Tidak | Tanggal mulai bekerja |
| `address` | string | Ya | Maksimum 255 karakter |
| `created_at` | datetime | Tidak | Dibuat oleh server |
| `updated_at` | datetime | Tidak | Diperbarui oleh server |

**Pembaruan penting untuk FE:** jangan kirim atau membaca `work_location` lagi. Gunakan `branch_id` untuk menyimpan relasi lokasi kerja; endpoint detail memberi relasi `branch`, dan list memberi `branch_name`. Pilihan posisi disimpan sebagai `position_id`; list memberi label nama pada field `position`, sedangkan detail memberi objek `position`.

### Endpoint Employee

| Method | Endpoint | Permission | Keterangan |
|---|---|---|---|
| GET | `/employees` | `employee.read` | List, filter, dan pagination |
| GET | `/employees/export` | `employee.export` | Download CSV |
| GET | `/employees/:id/detail` | `employee.read` | Detail dengan relasi department, position, branch, manager |
| POST | `/employees/create` | `employee.create` | Buat employee |
| PUT | `/employees/:id/update` | `employee.update` | Update employee |
| DELETE | `/employees/:id/delete` | `employee.delete` | Soft delete employee |
| PATCH | `/employees/:id/status` | `employee.update` | Toggle flag `status`; tanpa body |
| GET | `/employees/get-all-departments` | `department.read` | Pilihan department aktif (`id`, `name`) |

### Query list Employee

- Pagination: `page` (default `1`), `per_page` (default `10`, maksimum `100`).
- Pencarian teks: `q` pada nama depan, nama belakang, dan email.
- Filter: `status` (`true`/`false`), `department_id`, `branch_id`, `manager_id`, `position` (pencarian sebagian nama posisi), `employment_type`, `employment_status`, `hire_date_from`, `hire_date_to`.
- Sorting: `sort_by` (`employee_code`, `first_name`, `last_name`, `email`, `department_name`, `position`, `branch_name`, `employment_type`, `employment_status`, `status`, `hire_date`, `created_at`, `updated_at`); `sort_order` (`ASC`/`DESC`). Default `created_at DESC`.

List mengembalikan employee sebagai objek dengan nilai relasi diringkas:

```json
{
  "id": "employee-id",
  "employee_code": "EMP-0001",
  "first_name": "Ayu",
  "last_name": "Putri",
  "email": "ayu@example.com",
  "phone_number": "+62 812 3456 7890",
  "department_id": "department-id",
  "department_name": "Engineering",
  "position_id": "position-id",
  "position": "Software Engineer",
  "branch_id": "branch-id",
  "branch_name": "Head Office",
  "manager_id": "manager-employee-id",
  "manager_first_name": "Budi",
  "manager_last_name": "Santoso",
  "employment_type": "PERMANENT",
  "employment_status": "ACTIVE",
  "contract_start_date": null,
  "contract_end_date": null,
  "status": true,
  "hire_date": "2026-10-10T00:00:00.000Z",
  "address": "Jakarta",
  "created_at": "2026-10-10T00:00:00.000Z",
  "updated_at": "2026-10-10T00:00:00.000Z"
}
```

Detail mengembalikan field employee dan relasi:

- `department`: data model Department.
- `position`: data Position dengan `id`, `name`, dan `description`.
- `branch`: data Branch, atau `null` jika `branch_id` kosong.
- `manager`: ringkasan `id`, `employee_code`, `first_name`, `last_name`, atau `null`.

### Create/Update Employee

Contoh body create:

```json
{
  "employee_code": "EMP-0001",
  "first_name": "Ayu",
  "last_name": "Putri",
  "email": "ayu@example.com",
  "phone_number": "+62 812 3456 7890",
  "department_id": "department-id",
  "position_id": "position-id",
  "branch_id": "branch-id",
  "manager_id": null,
  "employment_type": "PERMANENT",
  "employment_status": "ACTIVE",
  "contract_start_date": null,
  "contract_end_date": null,
  "status": true,
  "hire_date": "2026-10-10",
  "address": "Jakarta"
}
```

Wajib saat create: `first_name`, `last_name`, `email`, `phone_number`, `department_id`, `position_id`, dan `hire_date`. `employee_code` dibuat otomatis bila tidak dikirim. `branch_id` dan `manager_id` nullable/opsional. Request tidak menerima `work_location`.

Jika `employment_type` bernilai `CONTRACT`, `contract_start_date` dan `contract_end_date` wajib dan end date harus tidak lebih awal dari start date. Department/position harus memakai ID valid. `branch_id` yang dikirim harus menunjuk branch aktif. `manager_id` harus menunjuk employee yang ada dan tidak boleh menghasilkan reporting cycle.

Update menerima subset field tersebut dan butuh minimal satu field. Tetap kirim field kontrak yang diperlukan jika perubahan `employment_type` membuat employee menjadi `CONTRACT`. API mengembalikan `data: null` pada create/update; ambil detail/list lagi bila FE membutuhkan record hasil mutasi.

## Link Leaves

Untuk jenis cuti, request, kalender, saldo, dan permission Leaves, lihat [`leaves-api.md`](./leaves-api.md).
