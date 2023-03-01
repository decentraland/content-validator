import { EntityType } from '@dcl/schemas'
import {
  AccessCheckerComponent,
  ContentValidatorComponents,
  DeploymentToValidate,
  OK,
  ValidateFn,
  validationFailed,
  ValidationResponse
} from '../../types'
import { createPointerValidateFn } from './profiles'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '../timestamps'
import { createStoreValidateFn } from './stores'

function enrich(accessCheckers: Record<EntityType, ValidateFn>, entityType: EntityType, validateFn: ValidateFn) {
  const oldFn = accessCheckers[entityType]
  accessCheckers[entityType] = async (deployment: DeploymentToValidate): Promise<ValidationResponse> => {
    const result = await validateFn(deployment)
    if (!result.ok) {
      return result
    }
    return oldFn(deployment)
  }
}
/**
 * Validate that the pointers are valid, and that the Ethereum address has write access to them
 * @public
 */
export async function createAccessCheckerComponent(
  components: Pick<ContentValidatorComponents, 'externalCalls' | 'config'>,
  accessCheckers: Record<EntityType, ValidateFn>
): Promise<AccessCheckerComponent> {
  const { config, externalCalls } = components

  if ((await config.getString('IGNORE_BLOCKCHAIN_ACCESS_CHECKS')) === 'true') {
    return { checkAccess: (_deployment: DeploymentToValidate) => Promise.resolve(OK) }
  }

  enrich(accessCheckers, EntityType.PROFILE, createPointerValidateFn(components))
  enrich(accessCheckers, EntityType.STORE, createStoreValidateFn(components))

  async function checkAccess(deployment: DeploymentToValidate): Promise<ValidationResponse> {
    const deployedBeforeDCLLaunch = deployment.entity.timestamp <= LEGACY_CONTENT_MIGRATION_TIMESTAMP
    const address = externalCalls.ownerAddress(deployment.auditInfo)

    const isDefaultScene =
      deployment.entity.type === EntityType.SCENE &&
      deployment.entity.pointers.some((p) => p.toLowerCase().startsWith('default'))

    // Default scenes were removed from the Content Servers after https://github.com/decentraland/catalyst/issues/878
    if (isDefaultScene) {
      return validationFailed(
        `Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45).`
      )
    }
    // Legacy entities still need to be synchronized
    if (deployedBeforeDCLLaunch && externalCalls.isAddressOwnedByDecentraland(address)) {
      return OK
    }

    return accessCheckers[deployment.entity.type](deployment)
  }

  return {
    checkAccess
  }
}
