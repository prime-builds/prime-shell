use std::io::{self, Write};

pub struct Crc32 {
    table: [u32; 256],
}

impl Crc32 {
    pub const fn new() -> Self {
        let mut table = [0u32; 256];
        let mut i = 0usize;
        while i < 256 {
            let mut c = i as u32;
            let mut j = 0usize;
            while j < 8 {
                if c & 1 != 0 {
                    c = 0xedb88320 ^ (c >> 1);
                } else {
                    c >>= 1;
                }
                j += 1;
            }
            table[i] = c;
            i += 1;
        }
        Self { table }
    }

    pub fn checksum(&self, data: &[u8]) -> u32 {
        let mut c = 0xffff_ffffu32;
        for &byte in data {
            let index = ((c ^ (byte as u32)) & 0xff) as usize;
            c = self.table[index] ^ (c >> 8);
        }
        !c
    }
}

pub static CRC32: Crc32 = Crc32::new();

struct ZipEntryMeta {
    name: String,
    crc32: u32,
    size: usize,
    local_header_offset: u32,
}

pub struct ZipWriter<W: Write> {
    writer: W,
    entries: Vec<ZipEntryMeta>,
    current_offset: u32,
}

impl<W: Write> ZipWriter<W> {
    pub fn new(writer: W) -> Self {
        Self {
            writer,
            entries: Vec::new(),
            current_offset: 0,
        }
    }

    pub fn add_file(&mut self, name: &str, data: &[u8]) -> io::Result<()> {
        // Validate name: no path traversal, no leading slashes
        if name.contains("..") || name.starts_with('/') || name.starts_with('\\') {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "Invalid zip entry name",
            ));
        }

        let crc = CRC32.checksum(data);
        let name_bytes = name.as_bytes();
        let name_len = name_bytes.len() as u16;
        let data_len = data.len() as u32;
        let local_offset = self.current_offset;

        // Local file header: 30 bytes + name + data
        let mut header = Vec::with_capacity(30 + name_bytes.len());
        header.extend_from_slice(&0x04034b50u32.to_le_bytes()); // signature
        header.extend_from_slice(&20u16.to_le_bytes()); // version needed (2.0)
        header.extend_from_slice(&0u16.to_le_bytes()); // general purpose flags
        header.extend_from_slice(&0u16.to_le_bytes()); // compression method (0 = store)
        header.extend_from_slice(&0u16.to_le_bytes()); // last mod file time
        header.extend_from_slice(&0u16.to_le_bytes()); // last mod file date
        header.extend_from_slice(&crc.to_le_bytes()); // crc32
        header.extend_from_slice(&data_len.to_le_bytes()); // compressed size
        header.extend_from_slice(&data_len.to_le_bytes()); // uncompressed size
        header.extend_from_slice(&name_len.to_le_bytes()); // filename length
        header.extend_from_slice(&0u16.to_le_bytes()); // extra field length
        header.extend_from_slice(name_bytes);

        self.writer.write_all(&header)?;
        self.writer.write_all(data)?;

        self.current_offset += header.len() as u32 + data_len;
        self.entries.push(ZipEntryMeta {
            name: name.to_string(),
            crc32: crc,
            size: data.len(),
            local_header_offset: local_offset,
        });

        Ok(())
    }

    pub fn finish(mut self) -> io::Result<()> {
        let cd_start_offset = self.current_offset;

        // Write Central Directory Headers
        let mut cd_bytes = Vec::new();
        for entry in &self.entries {
            let name_bytes = entry.name.as_bytes();
            let name_len = name_bytes.len() as u16;
            let size = entry.size as u32;

            cd_bytes.extend_from_slice(&0x02014b50u32.to_le_bytes()); // signature
            cd_bytes.extend_from_slice(&20u16.to_le_bytes()); // version made by
            cd_bytes.extend_from_slice(&20u16.to_le_bytes()); // version needed
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // flags
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // compression (store)
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // mod time
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // mod date
            cd_bytes.extend_from_slice(&entry.crc32.to_le_bytes()); // crc32
            cd_bytes.extend_from_slice(&size.to_le_bytes()); // compressed size
            cd_bytes.extend_from_slice(&size.to_le_bytes()); // uncompressed size
            cd_bytes.extend_from_slice(&name_len.to_le_bytes()); // filename length
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // extra field length
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // comment length
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // disk number start
            cd_bytes.extend_from_slice(&0u16.to_le_bytes()); // internal attrs
            cd_bytes.extend_from_slice(&0u32.to_le_bytes()); // external attrs
            cd_bytes.extend_from_slice(&entry.local_header_offset.to_le_bytes()); // local header offset
            cd_bytes.extend_from_slice(name_bytes);
        }

        self.writer.write_all(&cd_bytes)?;
        let cd_size = cd_bytes.len() as u32;

        // Write End of Central Directory Record (EOCD): 22 bytes
        let mut eocd = Vec::with_capacity(22);
        eocd.extend_from_slice(&0x06054b50u32.to_le_bytes()); // signature
        eocd.extend_from_slice(&0u16.to_le_bytes()); // disk number
        eocd.extend_from_slice(&0u16.to_le_bytes()); // start disk
        eocd.extend_from_slice(&(self.entries.len() as u16).to_le_bytes()); // entries on this disk
        eocd.extend_from_slice(&(self.entries.len() as u16).to_le_bytes()); // total entries
        eocd.extend_from_slice(&cd_size.to_le_bytes()); // size of cd
        eocd.extend_from_slice(&cd_start_offset.to_le_bytes()); // offset of cd
        eocd.extend_from_slice(&0u16.to_le_bytes()); // comment length

        self.writer.write_all(&eocd)?;
        self.writer.flush()?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zip_writer_roundtrip() {
        let mut buffer = Vec::new();
        let mut zip = ZipWriter::new(&mut buffer);
        zip.add_file("test.txt", b"hello world").unwrap();
        zip.add_file("nested/data.json", b"{\"key\":\"val\"}").unwrap();
        zip.finish().unwrap();

        // Check ZIP signature
        assert!(buffer.starts_with(&0x04034b50u32.to_le_bytes()));
        assert!(buffer.len() > 100);
    }
}
