/** ASCII usernames avoid ambiguity with email addresses and whitespace. */
export const MIN_USERNAME_LENGTH=3;
export const MAX_USERNAME_LENGTH=32;
export const MIN_ACCOUNT_PASSWORD_LENGTH=6;
export const MAX_ACCOUNT_PASSWORD_LENGTH=128;
export function normalizeUsername(value:string):string{return value.trim().toLowerCase();}
export function validUsername(value:string):boolean{
 return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}
export function validateNewPassword(value:unknown):value is string{
 return typeof value==='string'&&value.length>=MIN_ACCOUNT_PASSWORD_LENGTH&&value.length<=MAX_ACCOUNT_PASSWORD_LENGTH;
}
