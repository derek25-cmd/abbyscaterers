/** Today's date in Dar es Salaam as YYYY-MM-DD (the default costing price date). */
export function todayInDar(now: Date = new Date()): string {
    return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' });
}
