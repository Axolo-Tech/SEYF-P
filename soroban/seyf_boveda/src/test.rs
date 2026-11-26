extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Bytes, Env};

const CODE: &str = "Ship It";

fn setup() -> (Env, SeyfBovedaClient<'static>, TokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    let tk = TokenClient::new(&e, &sac.address());
    StellarAssetClient::new(&e, &sac.address()).mint(&admin, &10_000_0000000);
    let hash: BytesN<32> = e.crypto().sha256(&Bytes::from_slice(&e, CODE.as_bytes())).into();
    let id = e.register(SeyfBoveda, (admin.clone(), sac.address(), hash));
    let c = SeyfBovedaClient::new(&e, &id);
    c.fund(&admin, &5_555_0000000);
    (e, c, tk, admin)
}

#[test]
fn reclama_con_el_codigo_correcto() {
    let (e, c, tk, _) = setup();
    let user = Address::generate(&e);
    assert_eq!(c.balance(), 5_555_0000000);
    let got = c.claim(&user, &Bytes::from_slice(&e, CODE.as_bytes()));
    assert_eq!(got, 5_555_0000000);
    assert_eq!(tk.balance(&user), 5_555_0000000);
    assert_eq!(c.balance(), 0);
}

#[test]
fn rechaza_un_codigo_incorrecto() {
    let (e, c, tk, _) = setup();
    let user = Address::generate(&e);
    let r = c.try_claim(&user, &Bytes::from_slice(&e, b"ship it"));
    assert_eq!(r, Err(Ok(Error::WrongCode)));
    assert_eq!(tk.balance(&user), 0);
    assert_eq!(c.balance(), 5_555_0000000);
}

#[test]
fn bóveda_vacía_no_paga_dos_veces() {
    let (e, c, _, _) = setup();
    let code = Bytes::from_slice(&e, CODE.as_bytes());
    c.claim(&Address::generate(&e), &code);
    assert_eq!(c.try_claim(&Address::generate(&e), &code), Err(Ok(Error::Empty)));
}

#[test]
fn admin_recupera_el_saldo() {
    let (e, c, tk, _) = setup();
    let to = Address::generate(&e);
    assert_eq!(c.withdraw(&to), 5_555_0000000);
    assert_eq!(tk.balance(&to), 5_555_0000000);
}

#[test]
fn fund_rechaza_cero() {
    let (e, c, _, admin) = setup();
    let _ = e;
    assert_eq!(c.try_fund(&admin, &0), Err(Ok(Error::InvalidAmount)));
}
