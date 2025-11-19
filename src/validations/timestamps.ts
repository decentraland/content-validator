/**
 * 1652191200000 = 2022-05-10T14:00:00Z
 * @public
 */
export const ADR_45_TIMESTAMP = process.env.ADR_45_TIMESTAMP ? parseInt(process.env.ADR_45_TIMESTAMP) : 1652191200000

/**
 * 1658275200000 = 2022-07-20T00:00:00Z
 * @public
 */
export const ADR_75_TIMESTAMP = process.env.ADR_75_TIMESTAMP ? parseInt(process.env.ADR_75_TIMESTAMP) : 1658275200000

/**
 * 1669852800000 = 2022-09-12T13:00:00Z
 * @public
 */
export const ADR_74_TIMESTAMP = process.env.ADR_74_TIMESTAMP ? parseInt(process.env.ADR_74_TIMESTAMP) : 1662987600000

/**
 * 1674576000000 = 2023-01-24T15:00:00Z
 * @public
 */
export const ADR_158_TIMESTAMP = process.env.ADR_158_TIMESTAMP ? parseInt(process.env.ADR_158_TIMESTAMP) : 1674576000000

/**
 * 1673967600000 = 2023-01-17T15:00:00Z
 * @public
 */
export const ADR_173_TIMESTAMP = process.env.ADR_173_TIMESTAMP ? parseInt(process.env.ADR_173_TIMESTAMP) : 1673967600000

/**
 * 1686571200000 = 2023-06-12T12:00:00Z
 * @public
 */
export const ADR_232_TIMESTAMP = process.env.ADR_232_TIMESTAMP ? parseInt(process.env.ADR_232_TIMESTAMP) : 1686571200000

/**
 * 1684497600000 = 2023-05-19T12:00:00Z
 * @public
 */
export const ADR_236_TIMESTAMP = process.env.ADR_236_TIMESTAMP ? parseInt(process.env.ADR_236_TIMESTAMP) : 1684497600000

/**
 * 1710428400000 = 2024-03-14T15:00:00Z
 * @public
 */
export const ADR_244_TIMESTAMP = process.env.ADR_244_TIMESTAMP ? parseInt(process.env.ADR_244_TIMESTAMP) : 1710428400000

const THREE_MONTHS_IN_MS = 3 * 30 * 24 * 60 * 60 * 1000

/**
 * 1762743600000 = 2025-11-10T00:00:00Z
 * @public
 */
export const ADR_290_OPTIONAL_TIMESTAMP = process.env.ADR_290_TIMESTAMP
  ? parseInt(process.env.ADR_290_TIMESTAMP)
  : 1762743600000

export const ADR_290_REJECTED_TIMESTAMP = process.env.ADR_290_REJECTED_TIMESTAMP
  ? parseInt(process.env.ADR_290_REJECTED_TIMESTAMP)
  : ADR_290_OPTIONAL_TIMESTAMP + THREE_MONTHS_IN_MS

/**
 * DCL Launch Day
 * @public
 */
export const LEGACY_CONTENT_MIGRATION_TIMESTAMP = 1582167600000

/**
 * 1765767600000 = 2025-12-15T00:00:00Z
 * @public
 */
export const ADR_291_TIMESTAMP = process.env.ADR_291_TIMESTAMP ? parseInt(process.env.ADR_291_TIMESTAMP) : 1765767600000
