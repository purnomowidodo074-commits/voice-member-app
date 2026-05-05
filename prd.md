Tentu, ini adalah **Product Requirements Document (PRD)** dan rekomendasi **Tech Stack** untuk aplikasi **e-form Voice Member**. Dokumen ini dirancang agar mudah diimplementasikan menggunakan ekosistem Supabase.

---

## **Product Requirements Document (PRD): e-form Voice Member**

### **1. Ringkasan Proyek**
Membuat platform digital sederhana untuk menangkap aspirasi, keluhan, atau masukan dari anggota (Voice Member) di berbagai lini produksi dan menampilkannya secara terorganisir untuk kebutuhan tindak lanjut.

### **2. Fitur Utama**
*   **Halaman Form:** Input data aspirasi lengkap dengan fitur *upload* foto.
*   **Halaman Result:** Dashboard tabel yang menampilkan data secara *real-time* dengan urutan terbaru di atas.
*   **Export Data:** Kemampuan untuk mengunduh seluruh data dalam format `.csv`.
*   **Cloud Storage:** Penyimpanan foto hasil dokumentasi di server.

### **3. Spesifikasi Fungsional**

#### **A. Halaman Form (Input)**
1.  **Input Date:** 
    *   Default terisi tanggal hari ini (*Auto-fill*).
    *   User tetap bisa mengubah tanggal jika diperlukan.
2.  **Name:** Input teks untuk nama anggota.
3.  **Line (Dropdown):** Opsi terbatas pada:
    *   *Mel-Pour-Analys*
    *   *Mould-RCS*
    *   *Core Making*
    *   *Finishing*
    *   *Maintenance*
4.  **Voice Member:** Textarea (kotak teks besar) untuk deskripsi masukan.
5.  **Upload Photo:** Tombol untuk mengunggah file gambar sebagai lampiran.

#### **B. Halaman Result (Output)**
1.  **Tabel Data:** Menampilkan kolom Date, Name, Line, Voice Member, dan Thumbnail Foto.
2.  **Sorting:** Data wajib diurutkan berdasarkan `created_at` secara *Descending* (terbaru di paling atas).
3.  **Export CSV:** Tombol untuk mengekspor data yang ada di tabel ke format Excel/CSV.

---

### **4. Struktur Database (Supabase / PostgreSQL)**

| Nama Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `id` | UUID / Int8 | Primary Key (Auto-increment) |
| `created_at` | Timestamptz | Waktu input (Default: now()) |
| `input_date` | Date | Tanggal yang dipilih user |
| `member_name` | Text | Nama anggota |
| `line_name` | Text | Pilihan dari dropdown |
| `voice_text` | Text | Isi aspirasi/masukan |
| `photo_url` | Text | Link URL foto dari Supabase Storage |

---

## **Rekomendasi Tech Stack**

Berdasarkan kebutuhan aplikasi yang modern, cepat dideploy, dan memiliki skalabilitas yang baik, berikut adalah rekomendasi *stack*-nya:

### **1. Core Stack**
*   **Framework:** **Next.js (App Router)**. Sangat efisien untuk menangani *routing* antara halaman Form dan Result.
*   **Styling:** **Tailwind CSS**. Mempercepat proses desain UI yang responsif.
*   **Database & Backend:** **Supabase**.
    *   **PostgreSQL:** Untuk penyimpanan data teks.
    *   **Supabase Storage:** Untuk menyimpan file foto yang diunggah.
    *   **Supabase Auth (Opsional):** Jika kedepannya halaman Result ingin diproteksi agar hanya admin yang bisa melihat.

### **2. Library Pendukung**
*   **Form Handling:** **React Hook Form**. Memudahkan validasi input dan manajemen *state* form.
*   **UI Components:** **Shadcn/ui** atau **Mantine**. Untuk komponen Dropdown, DatePicker, dan Table yang sudah rapi secara visual.
*   **Export CSV:** **PapaParse** atau library standar `json-2-csv`.
*   **Icons:** **Lucide React**. Untuk ikon-ikon pelengkap seperti *upload* atau *download*.

---

### **Alur Kerja (Workflow)**

1.  **Submit Form:** Data teks dikirim ke tabel `voice_members` di Supabase, sementara file foto dikirim ke *Bucket* di Supabase Storage.
2.  **Generate URL:** Setelah foto berhasil di-upload, URL publiknya disimpan ke kolom `photo_url` di database.
3.  **Display Data:** Halaman Result memanggil data dari Supabase dengan query `.order('created_at', { ascending: false })`.
4.  **Export:** Fungsi export akan mengambil data yang ada di *state* tabel dan mengubahnya menjadi format CSV yang bisa langsung diunduh oleh browser