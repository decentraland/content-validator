export type WearableId = string // These ids are used as pointers on the content server

export type WearablesFilters = {
  collectionIds?: string[]
  wearableIds?: string[]
  textSearch?: string
}

export type ThirdPartyIntegration = {
  urn: string
  name: string
  description: string
}
