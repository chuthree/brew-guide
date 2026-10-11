/** Reject image fields before subject codecs can move them into descriptors. */
export function assertNoInlineImageFields(
  repositoryName: 'CoffeeBeanRepository' | 'BrewingNoteRepository',
  record: object,
  fields: readonly string[]
): void {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      throw new Error(
        `${repositoryName} cannot persist inline image field "${field}"; use aggregate persistence`
      );
    }
  }
}
