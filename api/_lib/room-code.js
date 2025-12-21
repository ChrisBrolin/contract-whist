/**
 * Generate a unique 6-character room code
 * Uses uppercase letters and numbers, excluding ambiguous characters (0, O, I, 1, L)
 */
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/**
 * Generate a unique room code that doesn't exist in the database
 */
async function generateUniqueRoomCode(supabase) {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode();

    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('room_code', code)
      .single();

    if (!data) {
      return code;
    }
  }

  throw new Error('Failed to generate unique room code');
}

module.exports = { generateRoomCode, generateUniqueRoomCode };
