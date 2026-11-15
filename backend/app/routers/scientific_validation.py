"""Scientific evidence summary over the existing comparison endpoint."""
from fastapi import APIRouter
from app.routers.comparability import PairRequest, evaluate_pair
from app.science.spherex_data.scientific_validation import validate_scientific_pair

router = APIRouter(prefix='/api', tags=['scientific-validation'])

@router.post('/scientific-validation')
def scientific_validation(request: PairRequest) -> dict:
    return validate_scientific_pair(evaluate_pair(request))
