//! Isolated Argon2id v1.3 browser-WASM proof of concept.
//!
//! This crate is intentionally not imported by the application. Profile IDs are
//! fixed here; callers cannot supply memory, time, or parallelism parameters.

use argon2::{Algorithm, Argon2, Params, Version};
use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;
use zeroize::Zeroize;

const OUTPUT_BYTES: usize = 32;
const SALT_BYTES: usize = 16;
const MAX_PASSWORD_BYTES: usize = 4_096;

/// Profile 1: 19 MiB, t=2, p=1 (OWASP password-storage baseline reference).
pub const PROFILE_POC_OWASP_BASELINE: u8 = 1;
/// Profile 2: 64 MiB, t=3, p=4 (RFC 9106 memory-constrained reference).
pub const PROFILE_POC_RFC9106_MEMORY: u8 = 2;

fn profile_params(profile_id: u8) -> Result<Params, &'static str> {
    let (memory_kib, iterations, lanes) = match profile_id {
        PROFILE_POC_OWASP_BASELINE => (19 * 1_024, 2, 1),
        PROFILE_POC_RFC9106_MEMORY => (64 * 1_024, 3, 4),
        _ => return Err("unsupported Argon2 profile"),
    };

    Params::new(memory_kib, iterations, lanes, Some(OUTPUT_BYTES))
        .map_err(|_| "invalid compiled Argon2 profile")
}

fn validate_inputs(password: &[u8], salt: &[u8]) -> Result<(), &'static str> {
    if password.is_empty() || password.len() > MAX_PASSWORD_BYTES {
        return Err("invalid password byte length");
    }
    if salt.len() != SALT_BYTES {
        return Err("salt must be exactly 16 bytes");
    }
    Ok(())
}

fn derive_key_bytes(
    password: &[u8],
    salt: &[u8],
    profile_id: u8,
) -> Result<[u8; OUTPUT_BYTES], &'static str> {
    validate_inputs(password, salt)?;
    let params = profile_params(profile_id)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut output = [0u8; OUTPUT_BYTES];
    if argon2
        .hash_password_into(password, salt, &mut output)
        .is_err()
    {
        output.zeroize();
        return Err("Argon2id derivation failed");
    }
    Ok(output)
}

/// Derive a 32-byte key using a compiled-in Argon2id v1.3 profile.
///
/// The password is supplied as UTF-8 bytes by the caller. The salt must be a
/// cryptographically random, per-vault 16-byte value. The returned Uint8Array
/// is a copy; the temporary Rust output buffer is zeroized before returning.
///
/// This function is synchronous. Production integration must invoke it from a
/// dedicated Worker and enforce a single in-flight derivation per vault.
#[wasm_bindgen]
pub fn derive_key(
    password: &[u8],
    salt: &[u8],
    profile_id: u8,
) -> Result<Uint8Array, JsValue> {
    let mut output = derive_key_bytes(password, salt, profile_id)
        .map_err(JsValue::from_str)?;
    let result = Uint8Array::from(output.as_slice());
    output.zeroize();
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use argon2::{AssociatedData, ParamsBuilder};

    #[test]
    fn only_two_fixed_profiles_are_accepted() {
        let profile_one = profile_params(PROFILE_POC_OWASP_BASELINE).expect("profile 1");
        assert_eq!(profile_one.m_cost(), 19 * 1_024);
        assert_eq!(profile_one.t_cost(), 2);
        assert_eq!(profile_one.p_cost(), 1);

        let profile_two = profile_params(PROFILE_POC_RFC9106_MEMORY).expect("profile 2");
        assert_eq!(profile_two.m_cost(), 64 * 1_024);
        assert_eq!(profile_two.t_cost(), 3);
        assert_eq!(profile_two.p_cost(), 4);

        assert!(profile_params(0).is_err());
        assert!(profile_params(3).is_err());
        assert!(profile_params(u8::MAX).is_err());
    }

    #[test]
    fn input_limits_are_enforced_before_kdf_allocation() {
        let salt = [0x02; SALT_BYTES];
        assert!(validate_inputs(b"unlock secret", &salt).is_ok());
        assert!(validate_inputs(b"", &salt).is_err());
        assert!(validate_inputs(&[0x41; MAX_PASSWORD_BYTES + 1], &salt).is_err());
        assert!(validate_inputs(b"unlock secret", &[0x02; 15]).is_err());
        assert!(validate_inputs(b"unlock secret", &[0x02; 17]).is_err());
    }

    #[test]
    fn fixed_profile_derivation_is_deterministic_and_salt_bound() {
        let password = b"test-only unlock secret";
        let salt_a = [0x11; SALT_BYTES];
        let salt_b = [0x12; SALT_BYTES];

        let mut first = derive_key_bytes(
            password,
            &salt_a,
            PROFILE_POC_OWASP_BASELINE,
        )
        .expect("first derivation");
        let mut repeated = derive_key_bytes(
            password,
            &salt_a,
            PROFILE_POC_OWASP_BASELINE,
        )
        .expect("repeated derivation");
        let mut other_salt = derive_key_bytes(
            password,
            &salt_b,
            PROFILE_POC_OWASP_BASELINE,
        )
        .expect("different-salt derivation");

        assert_eq!(first, repeated);
        assert_ne!(first, other_salt);

        first.zeroize();
        repeated.zeroize();
        other_salt.zeroize();
    }

    #[test]
    fn rfc_9106_section_5_3_argon2id_v13_known_answer() {
        // Official RFC vector: m=32 KiB, t=3, p=4, output=32 bytes.
        let password = [0x01; 32];
        let salt = [0x02; 16];
        let secret = [0x03; 8];
        let associated_data = AssociatedData::new(&[0x04; 12]).expect("RFC AD");

        let mut builder = ParamsBuilder::new();
        builder
            .m_cost(32)
            .t_cost(3)
            .p_cost(4)
            .output_len(OUTPUT_BYTES)
            .data(associated_data);
        let params = builder.build().expect("RFC parameters");
        let argon2 = Argon2::new_with_secret(
            &secret,
            Algorithm::Argon2id,
            Version::V0x13,
            params,
        )
        .expect("RFC secret");

        let mut output = [0u8; OUTPUT_BYTES];
        argon2
            .hash_password_into(&password, &salt, &mut output)
            .expect("RFC KAT derivation");

        let expected = [
            0x0d, 0x64, 0x0d, 0xf5, 0x8d, 0x78, 0x76, 0x6c,
            0x08, 0xc0, 0x37, 0xa3, 0x4a, 0x8b, 0x53, 0xc9,
            0xd0, 0x1e, 0xf0, 0x45, 0x2d, 0x75, 0xb6, 0x5e,
            0xb5, 0x25, 0x20, 0xe9, 0x6b, 0x01, 0xe6, 0x59,
        ];
        assert_eq!(output, expected);
        output.zeroize();
    }
}
