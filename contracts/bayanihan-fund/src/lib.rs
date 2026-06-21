#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, token,
    Address, Env, String,
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
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundRoles {
    pub treasurer: Address,
    pub president: Address,
    pub secretary: Address,
    pub token: Address,
}

#[contracttype]
pub enum DataKey {
    Roles,
    Balance,
    Reserved,
    RequestCount,
    Request(u64),
    Contribution(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FundError {
    InvalidAmount = 1,
    Unauthorized = 2,
    InsufficientBalance = 3,
    RequestNotFound = 4,
    AlreadyExecuted = 5,
    MissingApprovals = 6,
    InvalidRoles = 7,
    InvalidPurpose = 8,
    AlreadyApproved = 9,
}

const INSTANCE_TTL_THRESHOLD: u32 = 518_400;
const INSTANCE_TTL_EXTEND_TO: u32 = 2_073_600;

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn roles(env: &Env) -> FundRoles {
    env.storage().instance().get(&DataKey::Roles).unwrap()
}

fn balance(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
}

fn reserved(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Reserved).unwrap_or(0)
}

fn request(env: &Env, request_id: u64) -> Result<WithdrawalRequest, FundError> {
    env.storage()
        .instance()
        .get(&DataKey::Request(request_id))
        .ok_or(FundError::RequestNotFound)
}

#[contractimpl]
impl BayanihanFund {
    pub fn __constructor(
        env: Env,
        treasurer: Address,
        president: Address,
        secretary: Address,
        token: Address,
    ) {
        if treasurer == president || treasurer == secretary || president == secretary {
            panic_with_error!(&env, FundError::InvalidRoles);
        }

        env.storage().instance().set(
            &DataKey::Roles,
            &FundRoles {
                treasurer,
                president,
                secretary,
                token: token.clone(),
            },
        );
        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::Reserved, &0i128);
        env.storage().instance().set(&DataKey::RequestCount, &0u64);
        token::Client::new(&env, &token).balance(&env.current_contract_address());
        extend_instance_ttl(&env);
    }

    pub fn contribute(
        env: Env,
        contributor: Address,
        amount: i128,
    ) -> Result<(), FundError> {
        contributor.require_auth();
        extend_instance_ttl(&env);
        if amount <= 0 {
            return Err(FundError::InvalidAmount);
        }

        let config = roles(&env);
        token::Client::new(&env, &config.token).transfer(
            &contributor,
            &env.current_contract_address(),
            &amount,
        );

        env.storage()
            .instance()
            .set(&DataKey::Balance, &(balance(&env) + amount));
        let key = DataKey::Contribution(contributor.clone());
        let previous = env.storage().instance().get(&key).unwrap_or(0i128);
        env.storage().instance().set(&key, &(previous + amount));
        env.events()
            .publish((symbol_short!("deposit"), contributor), amount);
        Ok(())
    }

    pub fn create_request(
        env: Env,
        treasurer: Address,
        amount: i128,
        purpose: String,
        recipient: Address,
    ) -> Result<u64, FundError> {
        treasurer.require_auth();
        extend_instance_ttl(&env);
        if treasurer != roles(&env).treasurer {
            return Err(FundError::Unauthorized);
        }
        if amount <= 0 {
            return Err(FundError::InvalidAmount);
        }
        if purpose.len() == 0 || purpose.len() > 160 {
            return Err(FundError::InvalidPurpose);
        }
        if amount > balance(&env) - reserved(&env) {
            return Err(FundError::InsufficientBalance);
        }

        let request_id = env
            .storage()
            .instance()
            .get::<_, u64>(&DataKey::RequestCount)
            .unwrap_or(0)
            + 1;
        let withdrawal = WithdrawalRequest {
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
            .set(&DataKey::Request(request_id), &withdrawal);
        env.storage()
            .instance()
            .set(&DataKey::RequestCount, &request_id);
        env.storage()
            .instance()
            .set(&DataKey::Reserved, &(reserved(&env) + amount));
        env.events()
            .publish((symbol_short!("request"), request_id), withdrawal);
        Ok(request_id)
    }

    pub fn approve_request(
        env: Env,
        officer: Address,
        request_id: u64,
    ) -> Result<(), FundError> {
        officer.require_auth();
        extend_instance_ttl(&env);
        let config = roles(&env);
        let mut withdrawal = request(&env, request_id)?;
        if withdrawal.executed {
            return Err(FundError::AlreadyExecuted);
        }

        if officer == config.president {
            if withdrawal.president_approved {
                return Err(FundError::AlreadyApproved);
            }
            withdrawal.president_approved = true;
        } else if officer == config.secretary {
            if withdrawal.secretary_approved {
                return Err(FundError::AlreadyApproved);
            }
            withdrawal.secretary_approved = true;
        } else {
            return Err(FundError::Unauthorized);
        }

        env.storage()
            .instance()
            .set(&DataKey::Request(request_id), &withdrawal);
        env.events()
            .publish((symbol_short!("approved"), request_id), officer);
        Ok(())
    }

    pub fn execute_request(env: Env, request_id: u64) -> Result<(), FundError> {
        extend_instance_ttl(&env);
        let mut withdrawal = request(&env, request_id)?;
        if withdrawal.executed {
            return Err(FundError::AlreadyExecuted);
        }
        if !withdrawal.president_approved || !withdrawal.secretary_approved {
            return Err(FundError::MissingApprovals);
        }
        let current_balance = balance(&env);
        if withdrawal.amount > current_balance {
            return Err(FundError::InsufficientBalance);
        }

        let config = roles(&env);
        token::Client::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &withdrawal.recipient,
            &withdrawal.amount,
        );
        withdrawal.executed = true;
        env.storage()
            .instance()
            .set(&DataKey::Request(request_id), &withdrawal);
        env.storage()
            .instance()
            .set(&DataKey::Balance, &(current_balance - withdrawal.amount));
        env.storage().instance().set(
            &DataKey::Reserved,
            &(reserved(&env) - withdrawal.amount),
        );
        env.events()
            .publish((symbol_short!("executed"), request_id), withdrawal);
        Ok(())
    }

    pub fn get_balance(env: Env) -> i128 {
        balance(&env)
    }

    pub fn get_available_balance(env: Env) -> i128 {
        balance(&env) - reserved(&env)
    }

    pub fn get_request(env: Env, request_id: u64) -> Result<WithdrawalRequest, FundError> {
        request(&env, request_id)
    }

    pub fn get_request_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::RequestCount)
            .unwrap_or(0)
    }

    pub fn get_contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    pub fn get_roles(env: Env) -> FundRoles {
        roles(&env)
    }
}

mod test;
