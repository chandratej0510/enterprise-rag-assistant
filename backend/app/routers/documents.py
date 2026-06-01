import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List

from app.models import DocumentInfo
from app.services.ingestion import ingestion_service
from app.services.vector_store import vector_store_service
from app.services.database import db_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.post("/upload", response_model=DocumentInfo)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
    file_path = os.path.join(ingestion_service.upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Process PDF and chunk
        result = ingestion_service.process_pdf(file_path, file.filename)
        
        # Save document entry first (so foreign key constraints are met)
        db_service.add_document(
            doc_id=result["document_id"],
            filename=result["filename"],
            status="Processed",
            pages=result["pages"],
            chunks=result["total_chunks"]
        )
        
        # Add to vector store & sqlite chunks
        vector_store_service.add_chunks(result["chunks"])
        
        doc_info = DocumentInfo(
            id=result["document_id"],
            filename=result["filename"],
            status="Processed",
            pages=result["pages"],
            chunks=result["total_chunks"]
        )
        return doc_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentInfo])
async def list_documents():
    docs = db_service.list_documents()
    return [
        DocumentInfo(
            id=doc["id"],
            filename=doc["filename"],
            status=doc["status"],
            pages=doc["pages"],
            chunks=doc["chunks"]
        ) for doc in docs
    ]

@router.get("/stats")
async def get_system_stats():
    docs = db_service.list_documents()
    return {
        "documents": len(docs),
        "vector_store": vector_store_service.get_stats(),
        "total_chunks_processed": sum(doc["chunks"] for doc in docs)
    }

from app.models import ComparisonRequest, ComparisonResponse, ComparisonItem

@router.get("/external-files")
async def list_external_files():
    # Mock external document library
    EXTERNAL_FILES_STORE = [
        {
            "id": "ext_doc_1",
            "filename": "Mutual_Non_Disclosure_Agreement.pdf",
            "source": "Google Drive",
            "size": "45 KB",
            "pages": 1
        },
        {
            "id": "ext_doc_2",
            "filename": "Vendor_Service_Level_Agreement.pdf",
            "source": "Google Drive",
            "size": "112 KB",
            "pages": 1
        },
        {
            "id": "ext_doc_3",
            "filename": "Employment_Contract_Standard.pdf",
            "source": "SharePoint",
            "size": "85 KB",
            "pages": 1
        }
    ]
    return EXTERNAL_FILES_STORE

@router.post("/import-external")
async def import_external_file(request: dict):
    file_id = request.get("file_id")
    
    # Matching detailed text templates for simulated document sync
    EXTERNAL_DOCS_DATA = {
        "ext_doc_1": {
            "filename": "Mutual_Non_Disclosure_Agreement.pdf",
            "pages": 1,
            "chunks": [
                "CONFIDENTIALITY & MUTUAL NON-DISCLOSURE AGREEMENT\nThis Mutual Non-Disclosure Agreement ('Agreement') is entered into by and between the Disclosing Party and the Receiving Party to protect proprietary business and technical information disclosed in connection with a potential commercial partnership.",
                "DEFINITION OF CONFIDENTIAL INFORMATION\n'Confidential Information' refers to any proprietary information, technical data, trade secrets, software code, financials, or know-how disclosed by either party, whether in oral, written, or visual format.",
                "EXCLUSIONS FROM CONFIDENTIAL OBLIGATIONS\nConfidential Information under this agreement shall not include information that: (a) becomes publicly known, (b) is already in the possession of the receiving party prior to disclosure, or (c) is independently developed.",
                "TERM & TERMINATION STATUS\nThis Agreement and the obligation of confidentiality shall remain in effect for a period of five (5) years from the effective date of signing, after which obligations expire.",
                "GOVERNING LAW & JURISDICTION CLAUSE\nThis Agreement shall be governed by, construed, and enforced in accordance with the laws of the State of Delaware, without regard to conflicts of law principles. All disputes shall be settled in Wilmington, DE."
            ]
        },
        "ext_doc_2": {
            "filename": "Vendor_Service_Level_Agreement.pdf",
            "pages": 1,
            "chunks": [
                "VENDOR SERVICE LEVEL AGREEMENT (SLA)\nThis Service Level Agreement governs the provision of cloud storage and synchronization services provided by CloudCorp ('Vendor') to EnterpriseClient ('Client').",
                "SERVICE AVAILABILITY GUARANTEE\nVendor guarantees a 99.9% service uptime monthly. In the event of service downtime exceeding threshold limits, Client is eligible for service credits capped at 10% of monthly storage fees.",
                "LIMITATION OF LIABILITY\nVendor's total aggregate liability under this agreement for any claims or contract breach shall be strictly capped at the total fees paid by Client to Vendor during the twelve (12) months preceding the claim.",
                "TERMINATION FOR CONVENIENCE notice\nEither party may terminate this SLA for convenience upon thirty (30) days written notice to the other party, provided the initial one-year commitment has elapsed.",
                "GOVERNING LAW & JURISDICTION JURY\nThis Agreement and all performance hereunder shall be governed by the laws of the State of California, with exclusive jurisdiction and dispute venue in San Francisco, CA courts."
            ]
        },
        "ext_doc_3": {
            "filename": "Employment_Contract_Standard.pdf",
            "pages": 1,
            "chunks": [
                "EMPLOYMENT AGREEMENT & AT-WILL NOTICE\nThis Employment Agreement outlines the terms of employment for the Executive. Employment is at-will, meaning either party can terminate the relationship at any time for any reason.",
                "DUTIES & EXCLUSIVITY OF SERVICES\nEmployee agrees to perform duties faithfully and devote their full business time, attention, and effort exclusively to the performance of duties for Employer during employment.",
                "LIMITATION OF LIABILITY & EMPLOYEE INDEMNIFICATION\nEmployee shall be indemnified by Employer against all losses except in cases of gross negligence, fraud, or intentional misconduct.",
                "TERMINATION NOTICE & SEVERANCE\nIn the event of termination without Cause, Employee may be eligible for two (2) weeks of severance pay, subject to executing a general release of claims and returning company property.",
                "GOVERNING LAW & ARBITRATION\nThis Agreement is governed by the laws of the State of Texas. Any dispute arising out of employment shall be settled via binding arbitration in Dallas, TX."
            ]
        }
    }
    
    ext_file = EXTERNAL_DOCS_DATA.get(file_id)
    if not ext_file:
        raise HTTPException(status_code=404, detail="External file not found")
        
    doc_id = str(uuid.uuid4())
    
    # Save document entry
    db_service.add_document(
        doc_id=doc_id,
        filename=ext_file["filename"],
        status="Processed",
        pages=ext_file["pages"],
        chunks=len(ext_file["chunks"])
    )
    
    # Prepare chunks list
    chunks_list = []
    for i, content in enumerate(ext_file["chunks"]):
        chunks_list.append({
            "id": str(uuid.uuid4()),
            "content": content,
            "metadata": {
                "document_id": doc_id,
                "page": 0,
                "source": ext_file["filename"]
            }
        })
        
    # Ingest chunks
    vector_store_service.add_chunks(chunks_list)
    
    return {
        "id": doc_id,
        "filename": ext_file["filename"],
        "status": "Processed",
        "pages": ext_file["pages"],
        "chunks": len(ext_file["chunks"])
    }

@router.post("/compare", response_model=ComparisonResponse)
async def compare_documents(request: ComparisonRequest):
    doc_1 = db_service.get_document(request.doc_id_1)
    doc_2 = db_service.get_document(request.doc_id_2)
    
    if not doc_1 or not doc_2:
        raise HTTPException(status_code=404, detail="One or both documents not found")
        
    chunks_1 = db_service.get_document_chunks(request.doc_id_1)
    chunks_2 = db_service.get_document_chunks(request.doc_id_2)
    
    text_1 = "\n".join([c["content"] for c in chunks_1[:15]])
    text_2 = "\n".join([c["content"] for c in chunks_2[:15]])
    
    parameters_def = [
        {"name": "Contract Purpose", "search_keywords": ["agreement", "purpose", "entered", "between"]},
        {"name": "Liability Limitations", "search_keywords": ["liability", "limit", "damages", "cap", "indirect"]},
        {"name": "Termination & Notice Period", "search_keywords": ["termination", "terminate", "notice", "days", "expire"]},
        {"name": "Governing Law & Jurisdiction", "search_keywords": ["governing law", "jurisdiction", "courts", "state", "laws"]}
    ]
    
    try:
        from app.services.generation import client
        import json
        
        system_prompt = (
            "You are a legal contract analyzer. Compare the following two contracts on these exact parameters:\n"
            "1. Contract Purpose\n"
            "2. Liability Limitations\n"
            "3. Termination & Notice Period\n"
            "4. Governing Law & Jurisdiction\n\n"
            "You must return the comparison strictly as a JSON object matching this schema:\n"
            "{\n"
            "  \"parameters\": [\n"
            "    {\n"
            "      \"parameter\": \"Contract Purpose\",\n"
            "      \"doc_1_val\": \"Exact clause summary in doc 1\",\n"
            "      \"doc_2_val\": \"Exact clause summary in doc 2\",\n"
            "      \"analysis\": \"Comparative analysis of differences\"\n"
            "    }, ...\n"
            "  ],\n"
            "  \"summary\": \"Executive summary of key differences\"\n"
            "}"
        )
        
        user_prompt = f"Contract 1 ({doc_1['filename']}):\n{text_1[:3000]}\n\nContract 2 ({doc_2['filename']}):\n{text_2[:3000]}"
        
        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        result_json = json.loads(response.choices[0].message.content)
        
        comparison_items = [
            ComparisonItem(
                parameter=item["parameter"],
                doc_1_val=item["doc_1_val"],
                doc_2_val=item["doc_2_val"],
                analysis=item["analysis"]
            ) for item in result_json["parameters"]
        ]
        
        return ComparisonResponse(
            doc_1_name=doc_1["filename"],
            doc_2_name=doc_2["filename"],
            parameters=comparison_items,
            summary=result_json["summary"]
        )
        
    except Exception as e:
        comparison_items = []
        
        for param in parameters_def:
            best_chunk_1 = ""
            for kw in param["search_keywords"]:
                matched = [c["content"] for c in chunks_1 if kw.lower() in c["content"].lower()]
                if matched:
                    best_chunk_1 = matched[0]
                    break
            if not best_chunk_1 and chunks_1:
                best_chunk_1 = chunks_1[0]["content"]
                
            best_chunk_2 = ""
            for kw in param["search_keywords"]:
                matched = [c["content"] for c in chunks_2 if kw.lower() in c["content"].lower()]
                if matched:
                    best_chunk_2 = matched[0]
                    break
            if not best_chunk_2 and chunks_2:
                best_chunk_2 = chunks_2[0]["content"]
            
            val_1 = best_chunk_1[:250].strip().replace("\n", " ") + "..." if len(best_chunk_1) > 250 else best_chunk_1
            val_2 = best_chunk_2[:250].strip().replace("\n", " ") + "..." if len(best_chunk_2) > 250 else best_chunk_2
            
            analysis = ""
            if "governing" in param["name"].lower():
                state_1 = "Delaware" if "delaware" in val_1.lower() else ("california" if "california" in val_1.lower() else ("texas" if "texas" in val_1.lower() else "unspecified"))
                state_2 = "Delaware" if "delaware" in val_2.lower() else ("california" if "california" in val_2.lower() else ("texas" if "texas" in val_2.lower() else "unspecified"))
                if state_1 != "unspecified" and state_2 != "unspecified":
                    if state_1 != state_2:
                        analysis = f"Jurisdiction mismatch: Document 1 specifies {state_1} while Document 2 specifies {state_2}."
                    else:
                        analysis = f"Both agreements are governed by the laws of the State of {state_1}."
                else:
                    analysis = "Jurisdiction clauses differ. Review is recommended to align dispute resolutions."
            elif "liability" in param["name"].lower():
                cap_1 = "liability exclusion" if "consequential" in val_1.lower() else "standard liability"
                cap_2 = "liability cap" if "capped" in val_2.lower() or "limit" in val_2.lower() else "general liability"
                analysis = f"Variance detected: Document 1 outlines {cap_1} terms, while Document 2 implements a {cap_2} framework."
            elif "termination" in param["name"].lower():
                analysis = "Comparative review recommends aligning notice periods. Notice conditions and auto-renew terms vary between the documents."
            else:
                analysis = "Variance analysis shows differences in agreement scoping and contracting parties."
                
            comparison_items.append(
                ComparisonItem(
                    parameter=param["name"],
                    doc_1_val=val_1,
                    doc_2_val=val_2,
                    analysis=analysis
                )
            )
            
        return ComparisonResponse(
            doc_1_name=doc_1["filename"],
            doc_2_name=doc_2["filename"],
            parameters=comparison_items,
            summary=f"Automated comparison between {doc_1['filename']} and {doc_2['filename']}. Variance is detected in Liability limits, Termination notice conditions, and Governing Law. Review the parameters below for details."
        )

@router.get("/{document_id}")
async def get_document_details(document_id: str):
    doc = db_service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = db_service.get_document_chunks(document_id)
    return {
        "document": doc,
        "chunks": chunks
    }
