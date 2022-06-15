import { EntityType } from "@dcl/schemas"
import { ADR_74_TIMESTAMP } from "."
import { ContentValidatorComponents, DeploymentToValidate, OK, Validation, validationFailed } from "../types"
import { validationForType, validationGroup } from './validations'

const timestampIsAfterADR74: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    return deployment.entity.timestamp < ADR_74_TIMESTAMP
      ? validationFailed(`The emote timestamp ${deployment.entity.timestamp} is before ADR 74. Emotes did not exist before ADR 74.`)
      : OK
  }
}

const emoteDataVersionIsCorrectForEmoteTimestamp: Validation = {
  validate(components: ContentValidatorComponents, deployment: DeploymentToValidate) {
    const adrVersion = '74'
    return (`emoteData${adrVersion}` in deployment.entity.metadata)
      ? OK
      : validationFailed(`'emoteData' version is incorrect`)
  }
}

export const emote: Validation = validationForType(
  EntityType.EMOTE,
  validationGroup(
    timestampIsAfterADR74,
    emoteDataVersionIsCorrectForEmoteTimestamp))
