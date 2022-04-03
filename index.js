/* global performance: false */
/**
 * Stream CSV file to JSON.
 * @example `npm run dev your/file.csv`
 * The source file MUST have **comma** delimited columns in each row.
 * The source file MUST have **header** in *first* row.
 * The aforemented header will determine key names.
 */
import { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import { createInterface } from 'readline'
import { createHash, randomUUID } from 'crypto'
// const {
//   createHash
// } = await import('crypto')

/**
 * Normalize key names from file header.
 * @param {string} label
 * @returns {string}
 */
const normalizeKeys = label => (
  label
    .trim()
    .replace(/\s/g, '-')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/"/g, '')
    .toLowerCase()
)

const checksum = async values => {
  const hash = createHash('sha256')
  await hash.update(values.toString())
  // Only one element is going to be produced by the
  // hash stream.
  return hash.digest('hex')
}

/**
 * Write all the data to a single JSON file.
 * @param {Array} collection
 */
// const writeCompleteJSON = async collection => {
//   performance.mark('start:stringify-complete-json')
//   const stringed = JSON.stringify(collection, null, 2)
//   performance.mark('end:stringify-complete-json')
//   performance.measure('stringify-complete-json', {
//     start: 'start:stringify-complete-json',
//     end: 'end:stringify-complete-json'
//   })
//   // write entire collection to standard `json` file.
//   performance.mark('start:write-complete-json')
//   await writeFile(`${filePath}.json`, stringed)
//   performance.mark('end:write-complete-json')
//   performance.measure('write-complete-json', {
//     start: 'start:write-complete-json',
//     end: 'end:write-complete-json'
//   })
// }

let keyNames
let nonce = 0
const collection = []
/**
 * Process line by line.
 * @param {string} filePath
 * @see {@link https://nodejs.org/api/readline.html#example-read-file-stream-line-by-line}
 */
async function processLineByLine (filePath) {
  if (!filePath) {
    console.error('Need file path.')
    return
  }

  let fileStream
  try {
    fileStream = createReadStream(filePath)
  } catch (error) {
    console.error(error)
    return // stop the show
  }

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.

  for await (const line of rl) {
    // increment nonce with each new line
    ++nonce
    if (nonce === 1) {
      keyNames = line.split(',').map(item => normalizeKeys(item))
      console.log(`Key names: ${keyNames.join(',')}`)
      continue
    }
    performance.mark(`start:line:${nonce}`)
    const lineData = line.split(',').map((element, index) => {
      // remove double quotes and wrapping whitespace
      const cleaned = element.replace(/"/g, '').trim()
      // only save defined values
      if (cleaned === '') { return {} }
      return { [keyNames[index]]: cleaned }
    })
    const data = Object.assign({}, ...lineData)

    performance.mark(`start:uuid:${nonce}`)
    /**
     * Method 1: UUID as simple nonce.
     */
    // data.uuid = nonce

    /**
     * Method 2: UUID as `randomUUID`
     */
    // data.uuid = randomUUID()

    /**
     * Method 3: UUID as digest of data
     */
    data.uuid = await checksum(
      Object.values(data)
    )
    performance.mark(`end:uuid:${nonce}`)

    performance.mark(`end:line:${nonce}`)
    // write (or amend) each line to `ndjson` file.
    await writeFile(`${filePath}.ndjson`, `${JSON.stringify(data)}\n`, { flag: 'a' })

    // stash this for later
    collection.push(data)
    // Each line in input.txt will be successively available here as `line`.
    // console.log(`Line ${nonce} from file: ${JSON.stringify(data)}`)

    // save some metrics
    performance.measure(`line:${nonce}`, {
      start: `start:line:${nonce}`,
      end: `end:line:${nonce}`
    })
    performance.measure(`uuid:${nonce}`, {
      start: `start:uuid:${nonce}`,
      end: `end:uuid:${nonce}`
    })
  }

  await writeFile(`performance.json`, JSON.stringify(performance.getEntries(), null, 2))
  console.log('Process Complete.')
}

console.log(process.argv[2])

processLineByLine(process.argv[2])
