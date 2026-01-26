import { describe, it, expect } from 'vitest'
import {
  getTextureType,
  mapToMaterialProperty,
  getPropertyFromFilename,
  isKnownTextureType,
  hasMaterialProperty,
  TEXTURE_SUFFIXES
} from './textureMapping'

describe('textureMapping', () => {
  describe('getTextureType', () => {
    it('should return "albedo" for _alb suffix', () => {
      expect(getTextureType('pm0001_00_00_alb.png')).toBe('albedo')
    })

    it('should return "normal" for _nrm suffix', () => {
      expect(getTextureType('pm0001_00_00_nrm.png')).toBe('normal')
    })

    it('should return "emission" for _lym suffix', () => {
      expect(getTextureType('pm0001_00_00_lym.png')).toBe('emission')
    })

    it('should return "ao" for _ao suffix', () => {
      expect(getTextureType('pm0001_00_00_ao.png')).toBe('ao')
    })

    it('should return "mask" for _msk suffix', () => {
      expect(getTextureType('pm0001_00_00_msk.png')).toBe('mask')
    })

    it('should return "region" for _rgn suffix', () => {
      expect(getTextureType('pm0001_00_00_rgn.png')).toBe('region')
    })

    it('should return "unknown" for files without known suffix', () => {
      expect(getTextureType('pm0001_00_00.png')).toBe('unknown')
      expect(getTextureType('pm0001_00_00_00.png')).toBe('unknown')
      expect(getTextureType('texture.png')).toBe('unknown')
    })

    it('should handle different file extensions', () => {
      expect(getTextureType('texture_alb.jpg')).toBe('albedo')
      expect(getTextureType('texture_nrm.jpeg')).toBe('normal')
      expect(getTextureType('texture_lym.tga')).toBe('emission')
    })

    it('should handle empty string', () => {
      expect(getTextureType('')).toBe('unknown')
    })

    it('should handle files without extension', () => {
      expect(getTextureType('texture_alb')).toBe('albedo')
      expect(getTextureType('texture_nrm')).toBe('normal')
    })

    it('should be case sensitive', () => {
      expect(getTextureType('texture_ALB.png')).toBe('unknown')
      expect(getTextureType('texture_NRM.png')).toBe('unknown')
    })
  })

  describe('mapToMaterialProperty', () => {
    it('should map "albedo" to "map"', () => {
      expect(mapToMaterialProperty('albedo')).toBe('map')
    })

    it('should map "normal" to "normalMap"', () => {
      expect(mapToMaterialProperty('normal')).toBe('normalMap')
    })

    it('should map "emission" to "emissiveMap"', () => {
      expect(mapToMaterialProperty('emission')).toBe('emissiveMap')
    })

    it('should map "ao" to "aoMap"', () => {
      expect(mapToMaterialProperty('ao')).toBe('aoMap')
    })

    it('should map "mask" to "alphaMap"', () => {
      expect(mapToMaterialProperty('mask')).toBe('alphaMap')
    })

    it('should map "region" to null', () => {
      expect(mapToMaterialProperty('region')).toBeNull()
    })

    it('should map "unknown" to null', () => {
      expect(mapToMaterialProperty('unknown')).toBeNull()
    })
  })

  describe('getPropertyFromFilename', () => {
    it('should return "map" for _alb files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_alb.png')).toBe('map')
    })

    it('should return "normalMap" for _nrm files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_nrm.png')).toBe('normalMap')
    })

    it('should return "emissiveMap" for _lym files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_lym.png')).toBe('emissiveMap')
    })

    it('should return "aoMap" for _ao files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_ao.png')).toBe('aoMap')
    })

    it('should return "alphaMap" for _msk files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_msk.png')).toBe('alphaMap')
    })

    it('should return null for _rgn files', () => {
      expect(getPropertyFromFilename('pm0001_00_00_rgn.png')).toBeNull()
    })

    it('should return null for unknown files', () => {
      expect(getPropertyFromFilename('pm0001_00_00.png')).toBeNull()
    })
  })

  describe('isKnownTextureType', () => {
    it('should return true for known texture types', () => {
      expect(isKnownTextureType('texture_alb.png')).toBe(true)
      expect(isKnownTextureType('texture_nrm.png')).toBe(true)
      expect(isKnownTextureType('texture_lym.png')).toBe(true)
      expect(isKnownTextureType('texture_ao.png')).toBe(true)
      expect(isKnownTextureType('texture_msk.png')).toBe(true)
      expect(isKnownTextureType('texture_rgn.png')).toBe(true)
    })

    it('should return false for unknown texture types', () => {
      expect(isKnownTextureType('texture.png')).toBe(false)
      expect(isKnownTextureType('texture_00.png')).toBe(false)
      expect(isKnownTextureType('')).toBe(false)
    })
  })

  describe('hasMaterialProperty', () => {
    it('should return true for types with material properties', () => {
      expect(hasMaterialProperty('albedo')).toBe(true)
      expect(hasMaterialProperty('normal')).toBe(true)
      expect(hasMaterialProperty('emission')).toBe(true)
      expect(hasMaterialProperty('ao')).toBe(true)
      expect(hasMaterialProperty('mask')).toBe(true)
    })

    it('should return false for types without material properties', () => {
      expect(hasMaterialProperty('region')).toBe(false)
      expect(hasMaterialProperty('unknown')).toBe(false)
    })
  })

  describe('TEXTURE_SUFFIXES', () => {
    it('should contain all expected suffixes', () => {
      expect(TEXTURE_SUFFIXES).toContain('_alb')
      expect(TEXTURE_SUFFIXES).toContain('_nrm')
      expect(TEXTURE_SUFFIXES).toContain('_lym')
      expect(TEXTURE_SUFFIXES).toContain('_ao')
      expect(TEXTURE_SUFFIXES).toContain('_msk')
      expect(TEXTURE_SUFFIXES).toContain('_rgn')
    })

    it('should have exactly 6 suffixes', () => {
      expect(TEXTURE_SUFFIXES).toHaveLength(6)
    })
  })
})
