#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    token, Address, Env, IntoVal, String,
};

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

    let contract_id = env.register_contract(None, BayanihanFund);
    let client = BayanihanFundClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_id.address());

    let treasurer = Address::generate(&env);
    let president = Address::generate(&env);
    let secretary = Address::generate(&env);
    let resident = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_admin_client = token::StellarAssetClient::new(&env, &token_id.address());
    token_admin_client.mint(&resident, &1000);

    client.initialize(
        &treasurer,
        &president,
        &secretary,
        &token_id.address(),
    );

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
fn test_happy_path_mvp_transaction() {
    let (
        _env,
        client,
        token_client,
        treasurer,
        president,
        secretary,
        resident,
        recipient,
    ) = setup();

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
}

#[test]
#[should_panic(expected = "Only treasurer can create request")]
fn test_edge_case_unauthorized_request_creator() {
    let (_env, client, _token_client, _treasurer, _president, _secretary, resident, recipient) =
        setup();

    client.contribute(&resident, &50);

    client.create_request(
        &resident,
        &30,
        &String::from_str(&client.env, "Unauthorized request"),
        &recipient,
    );
}

#[test]
fn test_state_verification_after_contribution() {
    let (_env, client, _token_client, _treasurer, _president, _secretary, resident, _recipient) =
        setup();

    client.contribute(&resident, &50);

    assert_eq!(client.get_balance(), 50);
    assert_eq!(client.get_contribution(&resident), 50);
}

#[test]
#[should_panic(expected = "Missing approvals")]
fn test_cannot_execute_without_two_approvals() {
    let (_env, client, _token_client, treasurer, president, _secretary, resident, recipient) =
        setup();

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
fn test_request_storage_after_approval() {
    let (_env, client, _token_client, treasurer, president, _secretary, resident, recipient) =
        setup();

    client.contribute(&resident, &50);

    let request_id = client.create_request(
        &treasurer,
        &30,
        &String::from_str(&client.env, "Flood rescue boat fuel"),
        &recipient,
    );

    client.approve_request(&president, &request_id);

    let request = client.get_request(&request_id);

    assert_eq!(request.amount, 30);
    assert_eq!(request.president_approved, true);
    assert_eq!(request.secretary_approved, false);
    assert_eq!(request.executed, false);
}