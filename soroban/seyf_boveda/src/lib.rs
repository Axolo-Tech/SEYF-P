//! Bóveda "Ship It" (reto exprés, testnet).
//!
//! Guarda XLM (o cualquier token SAC) y lo suelta completo a quien presente el
//! código correcto. El contrato no guarda el código, solo su SHA-256: `claim`
//! compara el hash de lo que recibe. Cualquiera puede fondear con `fund`; el
//! admin puede recuperar el saldo con `withdraw` (para cerrar el reto).
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient, Address,
    Bytes, BytesN, Env,
};

#[contractevent(topics = ["funded"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent(topics = ["claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// El código no coincide con el hash guardado.
    WrongCode = 1,
    /// La bóveda no tiene saldo.
    Empty = 2,
    /// Monto cero o negativo.
    InvalidAmount = 3,
}

#[contracttype]
enum DataKey {
    Admin,
    Token,
    CodeHash,
}

const DAY_LEDGERS: u32 = 17_280;
const TTL_BUMP: u32 = 30 * DAY_LEDGERS;
const TTL_THRESHOLD: u32 = TTL_BUMP - DAY_LEDGERS;

#[contract]
pub struct SeyfBoveda;

fn bump(e: &Env) {
    e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
}

fn token(e: &Env) -> TokenClient<'_> {
    let addr: Address = e.storage().instance().get(&DataKey::Token).unwrap();
    TokenClient::new(e, &addr)
}

#[contractimpl]
impl SeyfBoveda {
    pub fn __constructor(e: Env, admin: Address, token: Address, code_hash: BytesN<32>) {
        let s = e.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::CodeHash, &code_hash);
        bump(&e);
    }

    /// Deposita `amount` del token desde `from` a la bóveda.
    pub fn fund(e: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        token(&e).transfer(&from, &e.current_contract_address(), &amount);
        Funded { from, amount }.publish(&e);
        bump(&e);
        Ok(())
    }

    /// Entrega todo el saldo a `to` si `code` es el correcto. Devuelve el monto.
    pub fn claim(e: Env, to: Address, code: Bytes) -> Result<i128, Error> {
        to.require_auth();
        let expected: BytesN<32> = e.storage().instance().get(&DataKey::CodeHash).unwrap();
        let got: BytesN<32> = e.crypto().sha256(&code).into();
        if got != expected {
            return Err(Error::WrongCode);
        }
        let tk = token(&e);
        let me = e.current_contract_address();
        let amount = tk.balance(&me);
        if amount <= 0 {
            return Err(Error::Empty);
        }
        tk.transfer(&me, &to, &amount);
        Claimed { to, amount }.publish(&e);
        bump(&e);
        Ok(amount)
    }

    /// El admin recupera todo el saldo (cierre del reto).
    pub fn withdraw(e: Env, to: Address) -> Result<i128, Error> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let tk = token(&e);
        let me = e.current_contract_address();
        let amount = tk.balance(&me);
        if amount <= 0 {
            return Err(Error::Empty);
        }
        tk.transfer(&me, &to, &amount);
        bump(&e);
        Ok(amount)
    }

    pub fn balance(e: Env) -> i128 {
        token(&e).balance(&e.current_contract_address())
    }

    pub fn token(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn code_hash(e: Env) -> BytesN<32> {
        e.storage().instance().get(&DataKey::CodeHash).unwrap()
    }
}

#[cfg(test)]
mod test;
