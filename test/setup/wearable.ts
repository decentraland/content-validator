import { Locale, Rarity, Wearable, WearableBodyShape, WearableCategory, WearableRepresentation } from '@dcl/schemas'

const representation: WearableRepresentation = {
  bodyShapes: [WearableBodyShape.FEMALE],
  mainFile: 'file1',
  contents: ['file1', 'file2'],
  overrideHides: [],
  overrideReplaces: [],
}

export const VALID_WEARABLE_METADATA: Wearable = {
  id: 'some id',
  descriptions: [
    {
      code: Locale.EN,
      text: 'some description',
    },
    {
      code: Locale.ES,
      text: 'una descripcion',
    },
  ],
  collectionAddress: '0x0000000collection_address',
  rarity: Rarity.LEGENDARY,
  names: [
    {
      code: Locale.EN,
      text: 'name',
    },
  ],
  data: {
    replaces: [],
    hides: [],
    tags: ['tag1'],
    representations: [representation],
    category: WearableCategory.UPPER_BODY,
  },
  thumbnail: 'thumbnail.png',
  image: 'image.png',
}
