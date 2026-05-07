// Cliente Sheets API directo desde frontend (con access_token del usuario)
// IDs de los archivos validados 2026-05-06

import { getAccessToken } from './auth'

export const SHEET_2026_ID = '1Mlkkg919mzOPv2mYM0Rv8Sgm6By7bURWTHW-JLrAvz8'
export const OFFERINGLIST_ID = '1BI2yvuvuWL37f7rvDayGHAzH_oZM9OKsmisnYtjF6bA'
export const SEGUIMIENTO_ID = '1yEFl6WkHBdsGNuJ36uqtyS9sF-uaD3DK' // .xlsx — requiere Drive API

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'

class SheetsError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'SheetsError'
  }
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  if (!token) throw new SheetsError('No hay sesión activa')
  const r = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!r.ok) {
    const txt = await r.text()
    throw new SheetsError(`Sheets API ${r.status}: ${txt}`, r.status)
  }
  return r.json() as Promise<T>
}

export interface ValueRange {
  range: string
  majorDimension?: 'ROWS' | 'COLUMNS'
  values?: string[][]
}

/** Lee un rango de celdas */
export async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  const data = await request<ValueRange>(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}`
  )
  return data.values ?? []
}

/** Escribe valores en un rango (sobrescribe) */
export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
): Promise<void> {
  await request(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  )
}

/** Append (agrega filas al final del rango) */
export async function appendRow(
  spreadsheetId: string,
  range: string,
  values: (string | number)[],
): Promise<void> {
  await request(
    `/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [values] }),
    },
  )
}

/** Lee múltiples rangos en una sola llamada */
export async function batchGet(
  spreadsheetId: string,
  ranges: string[],
): Promise<Record<string, string[][]>> {
  const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
  const data = await request<{ valueRanges: ValueRange[] }>(
    `/${spreadsheetId}/values:batchGet?${qs}`,
  )
  const out: Record<string, string[][]> = {}
  data.valueRanges?.forEach((vr, i) => {
    out[ranges[i]] = vr.values ?? []
  })
  return out
}

/** Devuelve el sheetId numérico de una pestaña por su título.
 *  Necesario para batchUpdate (deleteDimension, etc.) */
export async function getSheetIdByTitle(
  spreadsheetId: string,
  title: string,
): Promise<number> {
  const data = await request<{
    sheets: Array<{ properties: { sheetId: number; title: string } }>
  }>(`/${spreadsheetId}?fields=sheets.properties`)
  const sheet = data.sheets?.find(s => s.properties.title === title)
  if (!sheet) throw new SheetsError(`Pestaña "${title}" no encontrada`)
  return sheet.properties.sheetId
}

/** Borra una fila específica de una pestaña (1-indexed igual que el UI del Sheet) */
export async function deleteRow(
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber: number,
): Promise<void> {
  const sheetId = await getSheetIdByTitle(spreadsheetId, sheetTitle)
  await request(`/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,  // API es 0-indexed
            endIndex: rowNumber,
          },
        },
      }],
    }),
  })
}
