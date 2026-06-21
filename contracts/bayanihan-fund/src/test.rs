#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

fn setup() -> (
    Env,
    BayanihanFundClient<'static>,
    token::Client<'static>,
    Address,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_id.address());
    let treasurer = Address::generate(&env);
    let president = Address::generate(&env);
    let secretary = Address::generate(&env);
    let resident = Address::generate(&env);
    let recipient = Address::generate(&env);

    let contract_id = env.register(
        BayanihanFund,
        (
            treasurer.clone(),
            president.clone(),
            secretary.clone(),
            token_id.address(),
        ),
    );
    let client = BayanihanFundClient::new(&env, &contract_id);
    token::StellarAssetClient::new(&env, &token_id.address()).mint(&resident, &1000);

    (
        env,
        client,
        token_client,
        treasurer,
        president,
        secretary,
        resident,
        recipient,
    )
}

#[test]
fn happy_path_moves_tokens_and_updates_state() {
    let (_, client, token_client, treasurer, president, secretary, resident, recipient) = setup();
    client.contribute(&resident, &50);
    let request_id = client.create_request(
        &treasurer,
        &30,
        &String::from_str(&client.env, "Flood emergency supplies"),
        &recipient,
    );
    client.approve_request(&president, &request_id);
    client.approve_request(&secretary, &request_id);
    client.execute_request(&request_id);

    assert_eq!(token_client.balance(&recipient), 30);
    assert_eq!(client.get_balance(), 20);
    assert_eq!(client.get_available_balance(), 20);
}

#[test]
fn contribution_and_roles_are_readable() {
    let (_, client, _, treasurer, president, secretary, resident, _) = setup();
    client.contribute(&resident, &50);
    let roles = client.get_roles();

    assert_eq!(client.get_contribution(&resident), 50);
    assert_eq!(roles.treasurer, treasurer);
    assert_eq!(roles.president, president);
    assert_eq!(roles.secretary, secretary);
}

#[test]
fn requests_reserve_available_balance() {
    let (_, client, _, treasurer, president, _, resident, recipient) = setup();
    client.contribute(&resident, &50);
    let request_id = client.create_request(
        &treasurer,
        &30,
        &String::from_str(&client.env, "Medical emergency"),
        &recipient,
    );
    client.approve_request(&president, &request_id);

    let request = client.get_request(&request_id);
    assert_eq!(client.get_request_count(), 1);
    assert_eq!(client.get_available_balance(), 20);
    assert!(request.president_approved);
    assert!(!request.secretary_approved);
    assert!(!request.executed);
}

#[test]
#[should_panic]
fn unauthorized_account_cannot_create_request() {
    let (_, client, _, _, _, _, resident, recipient) = setup();
    client.contribute(&resident, &50);
    client.create_request(
        &resident,
        &30,
        &String::from_str(&client.env, "Unauthorized request"),
        &recipient,
    );
}

#[test]
#[should_panic]
fn request_cannot_execute_without_both_approvals() {
    let (_, client, _, treasurer, president, _, resident, recipient) = setup();
    client.contribute(&resident, &50);
    let request_id = client.create_request(
        &treasurer,
        &30,
        &String::from_str(&client.env, "Medical emergency"),
        &recipient,
    );
    client.approve_request(&president, &request_id);
    client.execute_request(&request_id);
}

#[test]
#[should_panic]
fn request_purpose_cannot_be_empty() {
    let (_, client, _, treasurer, _, _, resident, recipient) = setup();
    client.contribute(&resident, &50);
    client.create_request(
        &treasurer,
        &10,
        &String::from_str(&client.env, ""),
        &recipient,
    );
}

#[test]
#[should_panic]
fn officer_cannot_approve_twice() {
    let (_, client, _, treasurer, president, _, resident, recipient) = setup();
    client.contribute(&resident, &50);
    let request_id = client.create_request(
        &treasurer,
        &10,
        &String::from_str(&client.env, "Emergency supplies"),
        &recipient,
    );
    client.approve_request(&president, &request_id);
    client.approve_request(&president, &request_id);
}
