import { ArmatureId, EntityType } from '@dcl/schemas'
import { DeploymentToValidate } from '../../../../src'
import {
  emoteADR287ValidateFn,
  emoteRepresentationContentValidateFn,
  wasCreatedAfterADR74ValidateFn
} from '../../../../src/validations/items/emotes'
import {
  createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn,
  createThumbnailMaxSizeIsNotExceededValidateFn
} from '../../../../src/validations/items/items'
import { createSizeValidateFn } from '../../../../src/validations/size'
import { ADR_74_TIMESTAMP } from '../../../../src/validations/timestamps'
import { buildDeployment } from '../../../setup/deployments'
import { VALID_SOCIAL_EMOTE_METADATA, VALID_STANDARD_EMOTE_METADATA } from '../../../setup/emotes'
import { buildEntity } from '../../../setup/entity'
import { buildComponents, buildExternalCalls, createImage } from '../../../setup/mock'

describe('Emotes', () => {
  const timestampAfterADR74 = ADR_74_TIMESTAMP + 1
  const components = buildComponents()
  describe('Thumbnail:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'thumbnail.png'
    const hash = 'thumbnail'

    beforeAll(async () => {
      validThumbnailBuffer = await createImage(1024)
      invalidThumbnailBuffer = await createImage(1025)
    })

    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find hash for thumbnail file with name: ${fileName}`)
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't parse thumbnail, please check image format.`)
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid thumbnail image size (width = 1025 / height = 1025)`)
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When thumbnail file was already uploaded, it won't be validated again`, async () => {
      const content = [{ file: fileName, hash }]
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity })

      const externalCalls = buildExternalCalls({
        isContentStoredAlready: async () => new Map([[hash, true]])
      })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(buildComponents({ externalCalls }))
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Size:', () => {
    it(`When an emote is deployed and model is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1.5)],
        ['thumbnail', Buffer.alloc(1)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for emote model files is 2 MB. You can upload up to 2097152 bytes but you tried to upload 2621440.'
      )
    })
    it(`When an emote is deployed and thumbnail is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(2)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createSizeValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 3 MB for emote. You can upload up to 3145728 bytes but you tried to upload 4194304.'
      )
    })
    it(`when an emote is deployed and sizes are correct, then it is ok`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Content:', () => {
    it('when an emote representation is referencing files included in content, then it is ok', async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'file1', hash: '1' },
        { file: 'file2', hash: '2' }
      ]
      const files = new Map([
        ['file1', withSize(1)],
        ['file2', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await emoteRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeTruthy()
    })

    it('when an emote representation is referencing a file that is not present in the content array, it returns an error', async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'notFile1', hash: '1' },
        { file: 'file2', hash: '2' }
      ]
      const files = new Map([
        ['notFile1', withSize(1)],
        ['file2', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await emoteRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Representation content: 'file1' is not one of the content files`)
    })

    it('emote validation without representation fails', async () => {
      const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_STANDARD_EMOTE_METADATA }
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: {
          ...emoteWithoutData,
          emoteDataADR74: {
            ...emoteDataADR74,
            representations: []
          }
        },
        content: [
          { file: 'notFile1', hash: '1' },
          { file: 'file2', hash: '2' }
        ]
      })
      const deployment = buildDeployment({ entity })
      const result = await emoteRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`No emote representations found`)
    })

    it('emote validation without content fails', async () => {
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content: []
      })
      const deployment = buildDeployment({ entity })
      const result = await emoteRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`No content found`)
    })
  })

  describe('ADR 74', () => {
    it('emote validation with timestamp after adr 74 passes', async () => {
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content: [{ file: 'file1', hash: '1' }],
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity })
      const result = await wasCreatedAfterADR74ValidateFn(deployment)
      expect(result.ok).toBeTruthy()
    })
    it('emote validation with timestamp before adr 74 fails', async () => {
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_STANDARD_EMOTE_METADATA,
        content: [{ file: 'file1', hash: '1' }],
        timestamp: ADR_74_TIMESTAMP - 1
      })
      const deployment = buildDeployment({ entity })
      const result = await wasCreatedAfterADR74ValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `The emote timestamp ${ADR_74_TIMESTAMP - 1} is before ADR 74. Emotes did not exist before ADR 74.`
      )
    })
  })

  describe('ADR 287', () => {
    describe('when emote is a standard emote without social emote properties', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: VALID_STANDARD_EMOTE_METADATA,
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should pass validation', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeTruthy()
      })
    })

    describe('when emote has all social emote properties', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: VALID_SOCIAL_EMOTE_METADATA,
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should pass validation', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeTruthy()
      })
    })

    describe('when emote is missing startAnimation', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: undefined,
              randomizeOutcomes: false,
              outcomes: [
                {
                  title: 'High Five',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'HighFive_Avatar'
                    }
                  },
                  loop: true
                }
              ]
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error indicating missing startAnimation', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain(
          'For social emote definition, all properties must be present. Missing: startAnimation'
        )
      })
    })

    describe('when emote is missing randomizeOutcomes', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: undefined,
              outcomes: [
                {
                  title: 'High Five',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'HighFive_Avatar'
                    }
                  },
                  loop: true
                }
              ]
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error indicating missing randomizeOutcomes', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain(
          'For social emote definition, all properties must be present. Missing: randomizeOutcomes'
        )
      })
    })

    describe('when emote is missing outcomes', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: false,
              outcomes: undefined
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error indicating missing outcomes', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain(
          'For social emote definition, all properties must be present. Missing: outcomes'
        )
      })
    })

    describe('when emote is missing multiple social emote properties', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: undefined,
              outcomes: undefined
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error listing all missing properties', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain(
          'For social emote definition, all properties must be present. Missing: randomizeOutcomes, outcomes'
        )
      })
    })

    describe('when outcomes array is empty', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: false,
              outcomes: []
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error for empty outcomes array', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain('Outcomes array cannot be empty')
      })
    })

    describe('when outcomes array has more than 3 items', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: false,
              outcomes: [
                {
                  title: 'Outcome 1',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_1'
                    }
                  },
                  loop: true
                },
                {
                  title: 'Outcome 2',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_2'
                    }
                  },
                  loop: true
                },
                {
                  title: 'Outcome 3',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_3'
                    }
                  },
                  loop: true
                },
                {
                  title: 'Outcome 4',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_4'
                    }
                  },
                  loop: true
                }
              ]
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should return validation error for exceeding maximum outcomes', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeFalsy()
        expect(result.errors).toContain('Outcomes array can contain up to 3 items')
      })
    })

    describe('when outcomes array has exactly 3 items', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const { emoteDataADR74, ...emoteWithoutData } = { ...VALID_SOCIAL_EMOTE_METADATA }
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: {
            ...emoteWithoutData,
            emoteDataADR74: {
              ...emoteDataADR74,
              startAnimation: {
                loop: true,
                [ArmatureId.Armature]: {
                  animation: 'HighFive_Start'
                }
              },
              randomizeOutcomes: false,
              outcomes: [
                {
                  title: 'Outcome 1',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_1'
                    }
                  },
                  loop: true
                },
                {
                  title: 'Outcome 2',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_2'
                    }
                  },
                  loop: true
                },
                {
                  title: 'Outcome 3',
                  clips: {
                    [ArmatureId.Armature]: {
                      animation: 'Animation_3'
                    }
                  },
                  loop: true
                }
              ]
            }
          },
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should pass validation', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeTruthy()
      })
    })

    describe('when outcomes array has 1 item', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.EMOTE,
          metadata: VALID_SOCIAL_EMOTE_METADATA,
          content: [{ file: 'file1', hash: '1' }],
          timestamp: timestampAfterADR74
        })
        deployment = buildDeployment({ entity })
      })

      it('should pass validation', async () => {
        const result = await emoteADR287ValidateFn(deployment)
        expect(result.ok).toBeTruthy()
      })
    })
  })
})
