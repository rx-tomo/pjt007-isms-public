interface ZipFileEntry {
  name: string
  content: string | Buffer
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[i] = crc >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0 ^ -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buffer[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export function createZipBuffer(files: ZipFileEntry[]): Buffer {
  if (!files.length) {
    return Buffer.from([])
  }

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  files.forEach(file => {
    const contentBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf8')
    const fileNameBuffer = Buffer.from(file.name, 'utf8')
    const fileCrc = crc32(contentBuffer)

    const localHeader = Buffer.alloc(30 + fileNameBuffer.length)
    localHeader.writeUInt32LE(0x04034b50, 0) // Local file header signature
    localHeader.writeUInt16LE(20, 4) // Version needed to extract
    localHeader.writeUInt16LE(0, 6) // General purpose bit flag
    localHeader.writeUInt16LE(0, 8) // Compression method (0 = store)
    localHeader.writeUInt16LE(0, 10) // File last modification time (optional)
    localHeader.writeUInt16LE(0, 12) // File last modification date
    localHeader.writeUInt32LE(fileCrc, 14)
    localHeader.writeUInt32LE(contentBuffer.length, 18) // Compressed size
    localHeader.writeUInt32LE(contentBuffer.length, 22) // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuffer.length, 26) // File name length
    localHeader.writeUInt16LE(0, 28) // Extra field length
    fileNameBuffer.copy(localHeader, 30)

    localParts.push(localHeader, contentBuffer)

    const centralHeader = Buffer.alloc(46 + fileNameBuffer.length)
    centralHeader.writeUInt32LE(0x02014b50, 0) // Central directory signature
    centralHeader.writeUInt16LE(20, 4) // Version made by
    centralHeader.writeUInt16LE(20, 6) // Version needed to extract
    centralHeader.writeUInt16LE(0, 8) // General purpose bit flag
    centralHeader.writeUInt16LE(0, 10) // Compression method
    centralHeader.writeUInt16LE(0, 12) // File mod time
    centralHeader.writeUInt16LE(0, 14) // File mod date
    centralHeader.writeUInt32LE(fileCrc, 16)
    centralHeader.writeUInt32LE(contentBuffer.length, 20)
    centralHeader.writeUInt32LE(contentBuffer.length, 24)
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30) // Extra field length
    centralHeader.writeUInt16LE(0, 32) // File comment length
    centralHeader.writeUInt16LE(0, 34) // Disk number start
    centralHeader.writeUInt16LE(0, 36) // Internal file attributes
    centralHeader.writeUInt32LE(0, 38) // External file attributes
    centralHeader.writeUInt32LE(offset, 42)
    fileNameBuffer.copy(centralHeader, 46)

    centralParts.push(centralHeader)

    offset += localHeader.length + contentBuffer.length
  })

  const centralDirectory = Buffer.concat(centralParts)
  const centralSize = centralDirectory.length
  const centralOffset = localParts.reduce((sum, part) => sum + part.length, 0)

  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4) // Number of this disk
  endRecord.writeUInt16LE(0, 6) // Disk where central directory starts
  endRecord.writeUInt16LE(files.length, 8) // Number of central directory records on this disk
  endRecord.writeUInt16LE(files.length, 10) // Total number of central directory records
  endRecord.writeUInt32LE(centralSize, 12) // Size of central directory
  endRecord.writeUInt32LE(centralOffset, 16) // Offset of central directory
  endRecord.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([...localParts, centralDirectory, endRecord])
}

export type { ZipFileEntry }
