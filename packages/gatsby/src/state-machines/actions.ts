import {
  assign,
  AnyEventObject,
  ActionFunction,
  AssignAction,
  DoneInvokeEvent,
  ActionFunctionMap,
} from "xstate"
import { Store } from "redux"
import { IBuildContext, IMutationAction } from "../services"
import { actions } from "../redux/actions"
import { createGraphQLRunner } from "../bootstrap/create-graphql-runner"
import reporter from "gatsby-cli/lib/reporter"

const concatUnique = <T>(array1?: T[], array2?: T[]): T[] =>
  Array.from(new Set((array1 || []).concat(array2 || [])))

export const callRealApi = async (
  event: IMutationAction,
  store?: Store
): Promise<unknown> => {
  if (!store) {
    console.error(`No store`)
    return null
  }
  const { type, payload } = event
  if (type in actions) {
    store.dispatch(actions[type](...payload))
  }
  return null
}

type BuildMachineAction =
  | ActionFunction<IBuildContext, any>
  | AssignAction<IBuildContext, any>

/**
 * Handler for when we're inside handlers that should be able to mutate nodes
 */
export const callApi: BuildMachineAction = async (
  ctx,
  event
): Promise<unknown> => callRealApi(event.payload, ctx.store)

/**
 * Event handler used in all states where we're not ready to process node
 * mutations. Instead we add it to a batch to process when we're next idle
 */
export const addNodeMutation: BuildMachineAction = assign((ctx, event) => {
  return {
    nodeMutationBatch: ctx.nodeMutationBatch.concat([event.payload]),
  }
})

export const assignChangedPages: BuildMachineAction = assign<
  IBuildContext,
  DoneInvokeEvent<{
    changedPages: string[]
    deletedPages: string[]
  }>
>((context, event) => {
  console.log({ event })
  return {
    pagesToBuild: concatUnique(context.pagesToBuild, event.data.changedPages),
    pagesToDelete: concatUnique(context.pagesToDelete, event.data.deletedPages),
  }
})

/**
 * Event handler used in all states where we're not ready to process a file change
 * Instead we add it to a batch to process when we're next idle
 */
export const markFilesDirty: BuildMachineAction = assign<IBuildContext>({
  filesDirty: true,
})

export const markNodesDirty: BuildMachineAction = assign<IBuildContext>({
  nodesMutatedDuringQueryRun: true,
})

export const assignGatsbyNodeGraphQl: BuildMachineAction = assign<
  IBuildContext
>({
  gatsbyNodeGraphQLFunction: ({ store }: IBuildContext) =>
    store ? createGraphQLRunner(store, reporter) : undefined,
})

export const buildActions: ActionFunctionMap<IBuildContext, AnyEventObject> = {
  callApi,
  addNodeMutation,
  markFilesDirty,
  markNodesDirty,
  assignChangedPages,
  assignGatsbyNodeGraphQl,
}
