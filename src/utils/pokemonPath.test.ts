import { describe, it, expect } from 'vitest'
import {
  parsePokemonId,
  parseFormId,
  getThumbnailPath,
  getBigThumbnailPath,
  getPokemonIdFromFormId,
  isValidPokemonId,
  isValidFormId
} from './pokemonPath'

describe('pokemonPath', () => {
  describe('parsePokemonId', () => {
    it('should parse valid pokemon id "pm0001"', () => {
      const result = parsePokemonId('pm0001')
      expect(result).toEqual({
        id: 'pm0001',
        number: 1
      })
    })

    it('should parse valid pokemon id "pm0025"', () => {
      const result = parsePokemonId('pm0025')
      expect(result).toEqual({
        id: 'pm0025',
        number: 25
      })
    })

    it('should parse valid pokemon id "pm1000"', () => {
      const result = parsePokemonId('pm1000')
      expect(result).toEqual({
        id: 'pm1000',
        number: 1000
      })
    })

    it('should return null for invalid format without "pm" prefix', () => {
      expect(parsePokemonId('0001')).toBeNull()
    })

    it('should return null for invalid format with wrong digit count', () => {
      expect(parsePokemonId('pm001')).toBeNull()
      expect(parsePokemonId('pm00001')).toBeNull()
    })

    it('should return null for form id format', () => {
      expect(parsePokemonId('pm0001_00_00')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parsePokemonId('')).toBeNull()
    })

    it('should return null for non-numeric characters', () => {
      expect(parsePokemonId('pmabcd')).toBeNull()
    })
  })

  describe('parseFormId', () => {
    it('should parse valid form id "pm0001_00_00"', () => {
      const result = parseFormId('pm0001_00_00')
      expect(result).toEqual({
        id: 'pm0001_00_00',
        pokemonNumber: 1,
        formIndex: 0,
        variantIndex: 0
      })
    })

    it('should parse valid form id "pm0025_01_02"', () => {
      const result = parseFormId('pm0025_01_02')
      expect(result).toEqual({
        id: 'pm0025_01_02',
        pokemonNumber: 25,
        formIndex: 1,
        variantIndex: 2
      })
    })

    it('should parse valid form id with higher indices "pm0006_10_05"', () => {
      const result = parseFormId('pm0006_10_05')
      expect(result).toEqual({
        id: 'pm0006_10_05',
        pokemonNumber: 6,
        formIndex: 10,
        variantIndex: 5
      })
    })

    it('should return null for pokemon id format', () => {
      expect(parseFormId('pm0001')).toBeNull()
    })

    it('should return null for invalid format with wrong digit count', () => {
      expect(parseFormId('pm001_00_00')).toBeNull()
      expect(parseFormId('pm0001_0_00')).toBeNull()
      expect(parseFormId('pm0001_00_0')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseFormId('')).toBeNull()
    })

    it('should return null for non-numeric characters', () => {
      expect(parseFormId('pmabcd_00_00')).toBeNull()
    })
  })

  describe('getThumbnailPath', () => {
    it('should generate correct thumbnail path for "pm0001_00_00"', () => {
      const path = getThumbnailPath('pm0001_00_00')
      expect(path).toBe('pokemon/pm0001/pm0001_00_00/pm0001_00_00_00.png')
    })

    it('should generate correct thumbnail path for "pm0025_01_02"', () => {
      const path = getThumbnailPath('pm0025_01_02')
      expect(path).toBe('pokemon/pm0025/pm0025_01_02/pm0025_01_02_00.png')
    })

    it('should generate correct thumbnail path for "pm1000_99_99"', () => {
      const path = getThumbnailPath('pm1000_99_99')
      expect(path).toBe('pokemon/pm1000/pm1000_99_99/pm1000_99_99_00.png')
    })
  })

  describe('getBigThumbnailPath', () => {
    it('should generate correct big thumbnail path for "pm0001_00_00"', () => {
      const path = getBigThumbnailPath('pm0001_00_00')
      expect(path).toBe('pokemon/pm0001/pm0001_00_00/pm0001_00_00_00_big.png')
    })

    it('should generate correct big thumbnail path for "pm0025_01_02"', () => {
      const path = getBigThumbnailPath('pm0025_01_02')
      expect(path).toBe('pokemon/pm0025/pm0025_01_02/pm0025_01_02_00_big.png')
    })
  })

  describe('getPokemonIdFromFormId', () => {
    it('should extract pokemon id from form id "pm0001_00_00"', () => {
      expect(getPokemonIdFromFormId('pm0001_00_00')).toBe('pm0001')
    })

    it('should extract pokemon id from form id "pm0025_01_02"', () => {
      expect(getPokemonIdFromFormId('pm0025_01_02')).toBe('pm0025')
    })
  })

  describe('isValidPokemonId', () => {
    it('should return true for valid pokemon ids', () => {
      expect(isValidPokemonId('pm0001')).toBe(true)
      expect(isValidPokemonId('pm0025')).toBe(true)
      expect(isValidPokemonId('pm1000')).toBe(true)
    })

    it('should return false for invalid pokemon ids', () => {
      expect(isValidPokemonId('pm001')).toBe(false)
      expect(isValidPokemonId('pm0001_00_00')).toBe(false)
      expect(isValidPokemonId('')).toBe(false)
      expect(isValidPokemonId('invalid')).toBe(false)
    })
  })

  describe('isValidFormId', () => {
    it('should return true for valid form ids', () => {
      expect(isValidFormId('pm0001_00_00')).toBe(true)
      expect(isValidFormId('pm0025_01_02')).toBe(true)
      expect(isValidFormId('pm1000_99_99')).toBe(true)
    })

    it('should return false for invalid form ids', () => {
      expect(isValidFormId('pm0001')).toBe(false)
      expect(isValidFormId('pm001_00_00')).toBe(false)
      expect(isValidFormId('')).toBe(false)
      expect(isValidFormId('invalid')).toBe(false)
    })
  })
})
