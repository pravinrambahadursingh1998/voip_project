import { ChangeDetectorRef, Component, inject, input, OnInit, output } from '@angular/core';
import { AiFunctionItem } from '../../ai-function.models';
import { AiFunctionService } from '../../../../services/ai_function_service/ai-function';
import { AuthService } from '../../../../services/auth';
import { SpinnerService } from '../../../../shared/spinner/spinner.service';

@Component({
  selector: 'app-function-list',
  standalone: true,
  imports: [],
  templateUrl: './function-list.html',
  styleUrl: './function-list.css',
})
export class FunctionList implements OnInit {
  constructor (
    private aiFunctionService : AiFunctionService,
    private authService: AuthService,
    private showSpinner : SpinnerService,
    private  cd :ChangeDetectorRef
  ){}
    
  // readonly functions = input.required<AiFunctionItem[]>();
  readonly selectedId = input<string | null>(null);
  readonly isCreating = input(false);

  readonly selectFunction = output<string>();
  readonly createFunction = output<void>();
  token : any
  functions : any[] = []
  // selectedId : any
  

  ngOnInit(): void {
    this.token = this.authService.getToken();
    this.getFuncionData()
  }

  getFuncionData():void{
    const company_id = this.token?.company_id;

    let queryParam = '';
  
    if (company_id) {
      queryParam = `?company_id=${company_id}`;
    }
    
    // this.showSpinner.show()
    this.aiFunctionService.getFunctions(queryParam).subscribe(res =>{
      if(res.success == true){
        console.log('res',res)
        this.functions = res.data
        // this.showSpinner.hide()
        this.cd.detectChanges()
      }else{
        this.functions = []
        // this.showSpinner.hide()
        this.cd.detectChanges()
      }
    })
  }

}
