#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Symbol, Vec,
};

#[contract]
pub struct BayanihanFund;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WithdrawalRequest {
    pub id: u64,
    pub amount: i128,
    pub purpose: String,
    pub recipient: Address,
    pub president_approved: bool,
    pub secretary_approved: bool,
    pub executed: bool,
}

#[contracttype]
pub enum DataKey {
    Treasurer,
    President,
    Secretary,
    Token,
    Balance,
    RequestCount,
    Request(u64),
    Contribution(Address),
}

#[contractimpl]
impl BayanihanFund {
    pub fn initialize(
        env: Env,
        treasurer: Address,
        president: Address,
        secretary: Address,
        token: Address,
    ) {
        if env.storage().instance().has(&DataKey::Treasurer) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&DataKey::Treasurer, &treasurer);
        env.storage().instance().set(&DataKey::President, &president);
        env.storage().instance().set(&DataKey::Secretary, &secretary);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::RequestCount, &0u64);
    }

    pub fn contribute(env: Env, contributor: Address, amount: i128) {
        contributor.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token);

        client.transfer(
            &contributor,
            &env.current_contract_address(),
            &amount,
        );

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        env.storage().instance().set(&DataKey::Balance, &(balance + amount));

        let previous: i128 = env
            .storage()
            .instance()
            .get(&DataKey::Contribution(contributor.clone()))
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&DataKey::Contribution(contributor.clone()), &(previous + amount));

        env.events().publish(
            (symbol_short!("deposit"), contributor),
            amount,
        );
    }

    pub fn create_request(
        env: Env,
        treasurer: Address,
        amount: i128,
        purpose: String,
        recipient: Address,
    ) -> u64 {
        treasurer.require_auth();

        let saved_treasurer: Address = env.storage().instance().get(&DataKey::Treasurer).unwrap();

        if treasurer != saved_treasurer {
            panic!("Only treasurer can create request");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();

        if amount > balance {
            panic!("Insufficient fund balance");
        }

        let count: u64 = env.storage().instance().get(&DataKey::RequestCount).unwrap();
        let request_id = count + 1;

        let request = WithdrawalRequest {
            id: request_id,
            amount,
            purpose,
            recipient,
            president_approved: false,
            secretary_approved: false,
            executed: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Request(request_id), &request);

        env.storage()
            .instance()
            .set(&DataKey::RequestCount, &request_id);

        request_id
    }

    pub fn approve_request(env: Env, officer: Address, request_id: u64) {
        officer.require_auth();

        let president: Address = env.storage().instance().get(&DataKey::President).unwrap();
        let secretary: Address = env.storage().instance().get(&DataKey::Secretary).unwrap();

        let mut request: WithdrawalRequest = env
            .storage()
            .instance()
            .get(&DataKey::Request(request_id))
            .unwrap();

        if request.executed {
            panic!("Request already executed");
        }

        if officer == president {
            request.president_approved = true;
        } else if officer == secretary {
            request.secretary_approved = true;
        } else {
            panic!("Only officers can approve");
        }

        env.storage()
            .instance()
            .set(&DataKey::Request(request_id), &request);
    }

    pub fn execute_request(env: Env, request_id: u64) {
        let mut request: WithdrawalRequest = env
            .storage()
            .instance()
            .get(&DataKey::Request(request_id))
            .unwrap();

        if request.executed {
            panic!("Request already executed");
        }

        if !request.president_approved || !request.secretary_approved {
            panic!("Missing approvals");
        }

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();

        if request.amount > balance {
            panic!("Insufficient balance");
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let client = token::Client::new(&env, &token);

        client.transfer(
            &env.current_contract_address(),
            &request.recipient,
            &request.amount,
        );

        request.executed = true;

        env.storage()
            .instance()
            .set(&DataKey::Request(request_id), &request);

        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance - request.amount));
    }

    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap()
    }

    pub fn get_request(env: Env, request_id: u64) -> WithdrawalRequest {
        env.storage()
            .instance()
            .get(&DataKey::Request(request_id))
            .unwrap()
    }

    pub fn get_contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }
}

mod test;